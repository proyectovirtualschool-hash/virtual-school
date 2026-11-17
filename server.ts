import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Body parser
app.use(express.json({ limit: '20mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint for Gemini-powered attendance sheet OCR / scanning
app.post('/api/scan-attendance', async (req, res) => {
  try {
    const { imageBase64, mimeType, studentsList, allStudents, coursesContext, subjectsContext } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Se requiere la imagen en base64' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        success: false,
        recognized: false,
        error: 'NO_RECOGNITION',
        message: 'No se pudo reconocer la información de la imagen. Por favor, ingrese los datos manualmente.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
        timeout: 45000,
      }
    });

    // Use full students list for school-wide matching or course-specific list
    const referenceStudents = (allStudents && allStudents.length > 0) ? allStudents : (studentsList || []);

    const prompt = `Actúa como un EXPERTO EN LECTURA DE PLANILLAS FÍSICAS DE ASISTENCIA ESCOLAR. Tu ÚNICO OBJETIVO es extraer TODA la información visible con el MAYOR ESFUERZO POSIBLE.

REGLA FUNDAMENTAL: NO INVENTES, NO ADIVINES. Pero SÍ lee TODO lo que esté escrito aunque esté inclinado, con sombra, o parcialmente borroso. Intenta leerlo al máximo.

Base de datos para COTEJO ÚNICAMENTE (NO crear filas desde aquí):
${JSON.stringify(referenceStudents.slice(0, 150), null, 1)}

${coursesContext ? `Cursos disponibles:\n${JSON.stringify(coursesContext, null, 1)}\n` : ''}
${subjectsContext ? `Materias disponibles:\n${JSON.stringify(subjectsContext, null, 1)}\n` : ''}

INSTRUCCIONES - HAZ EL MAYOR ESFUERZO:
1. LEE TODO. Encabezado, fecha, curso, grado, materia, docente, horas, título, observaciones generales, TODA la tabla fila por fila en orden exacto.
2. BUSCA FIRMAS ESPECÍFICAMENTE. Identifica TODAS las firmas, rúbricas, sellos o espacios con "Firma", "Vo.Bo.", "Visto Bueno", "Revisado por", "Coordinador(a)", "Rector(a)", "Jefe(a)", "Docente", "Profesor(a)". Para cada una extrae el nombre escrito IMPRESO O MANUSCRITO junto a esa firma. Si hay firma pero NO hay nombre legible junto a ella, registra la firma con name: null y rawText con lo que se vea.
3. EXTRAER TABLA COMPLETA: Lee cada fila visible. Si un nombre está parcialmente legible pero reconocible, extráelo lo más fiel posible. NO omitas filas solo por estar borrosas - intenta leerlas.
4. POR FILA: sheetIndex, studentName (nombre COMPLETO como aparece), document (si aparece), markDetected (símbolo/letra exacta), status (inferir por marca visible), observation (cualquier nota escrita), hours.
5. ENCABEZADO: detectedDate (YYYY-MM-DD si visible), detectedCourse, detectedSubject, detectedTeacher (puedes poner aquí la firma principal si hay una clara), detectedHours, sheetTitle, generalObservations.
6. MARCAS: X/F/AUSENTE -> falla, R/T/RETARDO -> retardo, J/EXCUSA/PERMISO/JUSTIFICADA -> justificada, ✓/P/PRESENTE/OK/sin marca clara pero en contexto -> presente.
7. COTEJO: matchedStudentId solo si hay coincidencia clara con base de datos. Si no hay coincidencia, null (NO inventar).
8. INCLUYE TODO: estudiantes presentes, ausentes, con retardo, justificados. Todos los que aparezcan en la tabla.

SOLO RECHAZA si NO HAY ABSOLUTAMENTE NADA LEGIBLE: ni encabezado, ni tabla, ni texto. Si hay aunque sea encabezado o algunas filas, EXTRAELAS.

RESPONDE ÚNICAMENTE JSON VÁLIDO SIN TEXTO ADICIONAL:
{
  "detectedDate": "YYYY-MM-DD o null",
  "detectedCourse": "nombre o null",
  "detectedSubject": "nombre o null",
  "detectedTeacher": "nombre o firma leída o null",
  "detectedHours": 1|2|3|4 o null,
  "sheetTitle": "título o null",
  "generalObservations": "observaciones/otros o null",
  "detectedSignatures": [
    {
      "role": "docente|coordinador|rector|visto_bueno|otro",
      "name": "Nombre legible junto a la firma o null",
      "rawText": "Texto exacto visible junto a la firma",
      "confidence": "alta|media|baja"
    }
  ],
  "results": [
    {
      "sheetIndex": 1,
      "studentName": "nombre exacto como aparece",
      "document": "documento o null",
      "markDetected": "marca visible o null",
      "status": "falla|presente|justificada|retardo",
      "observation": "observación escrita o null",
      "hours": 2,
      "confidence": "alta|media|baja",
      "matchedStudentId": null
    }
  ]
}`;

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    let responseText = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType || 'image/jpeg'
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });
      responseText = response.text?.trim() || '{}';
    } catch (genError: any) {
      console.warn('[scan-attendance] Fallo primario con gemini-2.5-flash, probando reintento:', genError?.message);
      // Fallback try with gemini-flash-latest
      try {
        console.warn('[scan-attendance] Usando fallback gemini-flash-latest...');
        const fallbackResp = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType || 'image/jpeg'
                  }
                }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json'
          }
        });
        responseText = fallbackResp.text?.trim() || '{}';
      } catch (retryError) {
        throw genError;
      }
    }

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        return res.json({
          success: false,
          recognized: false,
          error: 'NO_RECOGNITION',
          message: 'No se pudo reconocer la información de la imagen. Por favor, ingrese los datos manualmente.'
        });
      }
    }

    const results = Array.isArray(parsedData.results) ? parsedData.results : [];
    const hasHeaderInfo = parsedData.detectedDate || parsedData.detectedCourse || parsedData.detectedSubject || parsedData.detectedTeacher || parsedData.sheetTitle || parsedData.generalObservations;
    
    // Only reject if truly nothing recognizable
    if (results.length === 0 && !hasHeaderInfo) {
      return res.json({
        success: false,
        recognized: false,
        error: 'NO_RECOGNITION',
        message: 'No se pudo reconocer la información de la imagen. Verifique que la planilla esté completa, nítida, bien iluminada y con el texto legible. Ajuste el recorte o ingrese los datos manualmente.'
      });
    }

    return res.json({
      success: true,
      recognized: true,
      data: parsedData
    });
  } catch (error: any) {
    console.error('Error procesando imagen con Gemini:', error);
    return res.json({
      success: false,
      recognized: false,
      error: 'NO_RECOGNITION',
      message: 'No se pudo reconocer la información de la imagen. Por favor, ingrese los datos manualmente.'
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sistema de Control de Fallas activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
