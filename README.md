# Control académico de fallas y asistencia

Aplicación web para registrar, consolidar y consultar fallas, retardos, justificaciones y asistencia escolar. Incluye un digitalizador local de planillas físicas que lee fotos o PDF y exige revisión humana antes de guardar.

## Funcionalidades

- Registro rápido de asistencia por curso, materia, fecha y horas.
- Portal de consulta para estudiantes y acudientes.
- Consolidado, alertas por porcentaje de fallas y reportes PDF/Excel.
- Gestión de estudiantes, cursos, materias y periodos.
- Digitalizador de planillas con TrOCR, Tesseract.js y OpenCV.js, sin nube.
- Historial de digitalizaciones con miniaturas y detalle por fila.

## Requisitos

- Node.js 20+
- Navegador moderno con WebAssembly

## Instalación

```bash
npm install
npm run setup:ocr
npm run dev
```

`setup:ocr` descarga el modelo TrOCR y prepara los binarios de Tesseract y ONNX Runtime en `public/`. Esos assets no se versionan porque ocupan cientos de MB.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con Vite y Express. |
| `npm run build` | Compila la aplicación. |
| `npm run lint` | Verificación de TypeScript. |
| `npm test` | Pruebas unitarias del digitalizador. |
| `npm run setup:ocr` | Descarga y prepara modelo y binarios OCR. |
| `npm run fixtures:generate` | Genera una planilla sintética de prueba. |

## Acceso

Credenciales de administrador por defecto: `admin` / `admin123`. Cambia la contraseña en Configuración antes de usar datos reales. No hay modo invitado.

## Digitalizador

Lee la guía completa en [docs/digitalizador.md](docs/digitalizador.md) y el protocolo de evaluación en [docs/ocr-benchmark.md](docs/ocr-benchmark.md).

Reglas principales:

- El OCR no inventa datos ni crea estudiantes.
- Las filas dudosas bloquean la confirmación.
- Los estudiantes de la matrícula que no aparecen en la hoja se agregan como `omitido`.
- No se guardan imágenes completas; solo la miniatura del historial.

## Privacidad

El digitalizador procesa todo en el navegador. No envía imágenes a servicios externos. Los datos académicos se guardan en `localStorage` del dispositivo.

## Licencias

Consulta [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
