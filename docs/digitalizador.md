# Digitalizador automático de planillas

Módulo para convertir fotos o PDF de planillas de asistencia en registros revisados dentro del sistema. Todo el reconocimiento ocurre en el navegador: las imágenes no se envían a ningún servidor ni API externa.

## Requisitos

- Node.js 20+ (probado con Node 24).
- Navegador de escritorio actualizado (Chrome o Edge recomendados) con WebAssembly.
- Al menos 4 GB de RAM libre para cargar TrOCR y OpenCV.
- La primera ejecución de `npm run setup:ocr` descarga el modelo y copia los binarios OCR.

## Instalación

```bash
npm install
npm run setup:ocr
npm run dev
```

`setup:ocr` hace dos cosas:

1. Descarga `Xenova/trocr-small-handwritten` en `public/models/trocr-small-handwritten/`.
2. Copia el worker de Tesseract, los núcleos WASM, el idioma `spa` y las variantes de ONNX Runtime en `public/ocr/`.

Esos directorios están en `.gitignore` porque ocupan cientos de MB y se regeneran con el script.

## Uso

1. Inicia sesión como administrador (`admin` / `admin123`).
2. Abre **Digitalizador IA** en la barra superior, o el botón **Digitalizar Planilla** dentro de Registro de Fallas.
3. Sube una foto, arrastra un archivo o usa la cámara del dispositivo. También acepta PDF de hasta 8 páginas.
4. Pulsa **Procesar planilla** y espera la lectura local.
5. Revisa el encabezado, los nombres, el cotejo con la matrícula, el estado y las observaciones.
6. Resuelve todas las filas bloqueantes. Puedes excluir una fila, pero la confirmación exige decidir las demás.
7. Confirma para guardar la asistencia y el historial.

### Filas bloqueantes

No se puede confirmar mientras existan filas activas con:

- `conflicto`: hay más de un estudiante parecido.
- `no_inscrito`: el nombre no coincide con la matrícula del curso.
- `ilegible`: no se pudo leer el nombre.
- `duplicado`: el mismo estudiante aparece dos veces.
- `omitido`: el estudiante está en la matrícula pero no se detectó en la hoja.
- estado `sin_definir`: no se pudo interpretar la marca.

Para resolverlas: corrige el nombre, elige el estudiante correcto, selecciona un estado o excluye la fila. Las filas omitidas se agregan automáticamente para que ninguna inasistencia quede por fuera.

## Reglas de integridad

- El OCR nunca inventa nombres, documentos ni estados.
- El digitalizador nunca crea estudiantes automáticamente. Si el nombre no existe, usa **Agregar estudiante real** y exige documento.
- «Presente» no genera un registro de falla; solo se guardan faltas, retardos y justificadas.
- Si ya existe un registro idéntico para el mismo estudiante, curso, materia, periodo, fecha y tipo, se omite.
- Un conflicto de horas no se sobrescribe: se informa y se deja el registro existente.
- La imagen completa no se guarda en el historial. Solo se conserva una miniatura de 220 px y el detalle de filas.

## Arquitectura

| Archivo | Responsabilidad |
| --- | --- |
| `src/services/digitizer/digitizer.ts` | Orquesta mejora, OCR, filas, marcas y cotejo. |
| `src/services/digitizer/opencv.ts` | Endereza, recorta perspectiva, mejora contraste y detecta la tabla. |
| `src/services/digitizer/ocrEngine.ts` | Worker singleton de Tesseract.js con assets locales. |
| `src/services/digitizer/trocr.ts` + `src/workers/trocr.worker.ts` | Inferencia TrOCR en Web Worker. |
| `src/services/digitizer/sheetParser.ts` | Parser TSV, encabezado, columnas, marcas y limpieza de nombres. |
| `src/services/digitizer/reconcile.ts` | Cotejo con matrícula, duplicados, omitidos y bloqueos. |
| `src/services/digitizer/persistence.ts` | Guardado de asistencia e historial. |
| `src/components/digitizer/DigitizerWizard.tsx` | Flujo de carga, progreso y revisión. |
| `src/components/digitizer/HistoryPanel.tsx` | Historial de las últimas 50 digitalizaciones. |

## Persistencia

- Asistencias: `scf_absences_v1` mediante `storage.saveDigitizedAttendance`.
- Historial: `scf_digitizations_v1`, máximo 50 entradas.
- La copia de seguridad exporta e importa ambos.
- Restablecer datos borra el historial de digitalizaciones.

## Limitaciones conocidas

- La precisión en manuscrito depende de la nitidez, el contraste y la caligrafía. La letra cursiva, las tildes y la ñ son los casos más difíciles.
- TrOCR small está optimizado para una sola línea de texto; nombres muy largos o con ruido pueden requerir corrección manual.
- La detección de marcas usa una región de marcas estimada. Si la hoja tiene varias columnas de marcas separadas, revisa cada fila.
- Sin muestras reales no se puede prometer un porcentaje de acierto. Usa `npm run fixtures:generate` para una prueba sintética y revisa `docs/ocr-benchmark.md`.
- TrOCR puede tardar varios segundos por fila en CPU. La primera carga del modelo es la más lenta.

## Solución de problemas

- **«No se pudo iniciar Tesseract local»**: ejecuta `npm run setup:ocr` y recarga.
- **TrOCR no carga**: revisa que existan los `.onnx` en `public/models/trocr-small-handwritten/onnx/`. Si falla, el flujo continúa con Tesseract y lo informa en advertencias.
- **OpenCV falla**: se aplica una mejora básica de contraste y se muestra una advertencia. La revisión manual sigue siendo obligatoria.
- **PDF no carga**: confirma que el archivo sea PDF real y no una imagen renombrada.
- **No aparecen filas**: usa una foto más frontal, con la hoja completa y buena iluminación.

## Privacidad

No hay llamadas de red para OCR. El servidor Express sigue exponiendo el endpoint anterior de Gemini, pero este módulo no lo usa. Las imágenes se procesan en memoria del navegador y se descartan al cerrar el flujo.
