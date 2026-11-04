# A Todo Tenis

Sitio de tenis que se actualiza solo: resultados, partidos en vivo, ranking y notas escritas con IA a partir de resultados reales.

## Cómo funciona

Cada hora, GitHub Actions ejecuta tres pasos (archivo `.github/workflows/actualizar.yml`):

1. **Recolector** (`scripts/update.mjs`): trae partidos en vivo, calendario, resultados y ranking desde Live Tennis API. Respeta el límite gratuito de 100 consultas por día.
2. **Redactor** (`scripts/articles.mjs`): por cada partido importante terminado (finales, semifinales, Copa Davis, Billie Jean King Cup, partidos de argentinos), Gemini escribe una nota. Si la nota menciona números o datos que no están en el resultado real, se descarta.
3. Guarda los cambios en el repositorio. Vercel lo detecta y publica el sitio (`scripts/build.mjs` genera las páginas).

## Ajustes sin programar (`config.json`)

- `notas.publicarAutomaticamente`: `true` publica las notas solas. Con `false` quedan guardadas pero no se muestran.
- `notas.maxNotasPorCorrida`: cuántas notas como máximo por hora.
- `api.calendarioCadaHoras`: cada cuántas horas se actualiza el calendario.

## Secretos (Settings → Secrets and variables → Actions)

- `LIVE_TENNIS_API_KEY`
- `GEMINI_API_KEY`

## Correr a mano

Pestaña **Actions** → **Actualizar sitio** → **Run workflow**.
