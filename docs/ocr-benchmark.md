# Benchmark OCR del digitalizador

## Objetivo

Medir de forma reproducible qué tan bien se leen planillas manuscritas con el stack local (TrOCR + Tesseract + OpenCV) y detectar regresiones antes de usar el módulo con hojas reales.

## Datos disponibles

- No hay planillas reales en el repositorio.
- `npm run fixtures:generate` crea `fixtures/planilla-demo.png` y `fixtures/planilla-demo.expected.json`.
- La fixture es sintética: encabezado impreso, nombres con tildes y eñes, marcas `✓`, `X`, `R`, `J`, una fila sin marca y dos estudiantes omitidos. No contiene datos personales reales.

## Métricas

Por cada página evaluada:

1. **Nombre exacto**: porcentaje de nombres que coinciden después de normalizar tildes y mayúsculas.
2. **Nombre cotejado**: porcentaje de filas asignadas al estudiante correcto.
3. **Marca correcta**: porcentaje de estados `presente`, `falla`, `retardo`, `justificada` correctos.
4. **Omitidos detectados**: estudiantes de la matrícula que no aparecen en la hoja y fueron agregados como `omitido`.
5. **Falsos positivos**: filas creadas para texto que no era un estudiante.
6. **Filas bloqueantes**: cantidad de filas que requirieron intervención humana.
7. **Tiempo**: milisegundos por página y por fila.

## Procedimiento manual

1. Genera la fixture y carga la imagen en **Digitalizador IA**.
2. Procesa con TrOCR activado.
3. Compara la tabla revisada contra `fixtures/planilla-demo.expected.json`.
4. Registra los conteos en una tabla como esta:

| Fecha | Navegador | Dispositivo | Página | Nombre exacto | Cotejado | Marca correcta | Omitidos | Falsos positivos | Bloqueantes | Tiempo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11-10 | Chrome 142 | Escritorio | demo | — | — | — | — | — | — | — |

## Criterios sugeridos

- No se considera listo para producción si hay más de 10% de marcas incorrectas sin bloquear.
- Toda fila con confianza baja, nombre ilegible o matrícula ambigua debe quedar bloqueante.
- Cualquier falso positivo debe poder excluirse y no debe guardarse sin revisión.
- La prueba con hojas reales requiere consentimiento y anonimización previa.

## Automatización pendiente

El benchmark de OCR real no está automatizado porque requiere navegador, WebAssembly y tiempos de inferencia variables. Las pruebas actuales (`npm test`) cubren parser, limpieza de nombres, fechas, marcas, cotejo, duplicados y omitidos. La evaluación de imagen completa debe hacerse en navegador.
