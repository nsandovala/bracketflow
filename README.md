# 🏆 BracketFlow

**BracketFlow** es una plataforma integral para gestionar torneos de videojuegos (Warzone, Fortnite y más) con generación automática de brackets, seguimiento de resultados en tiempo real y visualización optimizada para streaming.

---

## ✨ Características Principales

- 🎯 **Múltiples formatos de torneo**: WSOW BR, Rebirth, Kill Race y Roulette
- 🔀 **Brackets automáticos** con seeds ordenados por rendimiento
- 👥 **Gestión de equipos y participantes** con ruleta automática de asignación
- 💀 **Seguimiento de kills y colocaciones** por partida
- 📊 **Sistema de puntuación configurable** al estilo WSOW (multiplicadores por placement)
- 🏅 **Match Point configurable** por torneo (cierre automático de series)
- 🤖 **OCR + OpenAI Vision** para lectura automática de screenshots de scoreboard
- 📡 **Stream Hub para OBS** — visualización en vivo para casting sin herramientas externas
- 📈 **Leaderboard acumulativo** en tiempo real
- 📥 **Importación masiva** de jugadores vía CSV/TXT
- 🖥️ **Dashboard operativo** para gestión completa de torneos

---

## 🛠️ Tech Stack

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js + TypeScript |
| Backend | FastAPI + Python |
| Base de datos | SQLite (vía SQLAlchemy) |
| IA / Visión | OpenAI API (GPT-4o Vision) |
| Estilos | Tailwind CSS |

---

## 📁 Estructura del Proyecto

```
bracketflow/
├── app/
│   ├── frontend/          # Aplicación Next.js (UI, componentes, páginas)
│   ├── backend/           # API FastAPI (modelos, routers, lógica de negocio)
│   │   ├── app/
│   │   │   ├── main.py        # Punto de entrada FastAPI
│   │   │   ├── models.py      # Modelos SQLAlchemy
│   │   │   ├── routers/       # Endpoints por dominio
│   │   │   └── ocr_provider.py # Integración OpenAI Vision
│   │   ├── tests/         # Tests unitarios y de integración
│   │   └── requirements.txt
│   └── docs/              # Documentación técnica y reglas de producto
│       ├── TOURNAMENT_RULES.md   # Contrato de motores de torneo
│       └── TOURNAMENT_MODEL.md   # Modelo de datos
├── scripts/               # Scripts de utilidad
└── README.md
```

---

## 🚀 Cómo Empezar

### Requisitos Previos

- **Python 3.11+**
- **Node.js 18+** y npm
- **Clave de API de OpenAI** (opcional, requerida para OCR)

### 1. Backend (FastAPI)

```bash
cd app/backend

# Crear entorno virtual
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env             # Editar con tu OPENAI_API_KEY

# Iniciar el servidor
uvicorn app.main:app --reload --port 8000
```

La API estará disponible en `http://localhost:8000`.  
Documentación interactiva: `http://localhost:8000/docs`

### 2. Frontend (Next.js)

```bash
cd app/frontend

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### 3. Configuración de Variables de Entorno

Crea un archivo `.env` en `app/backend/`:

```env
# OpenAI (requerido para OCR de scoreboards)
OPENAI_API_KEY=sk-...
OCR_OPENAI_MODEL=gpt-4o       # Default: gpt-4o

# Base de datos SQLite (ruta opcional)
DATABASE_URL=sqlite:///./bracketflow.db
```

---

## 🎮 Uso Principal

1. **Crear un torneo** — Selecciona el formato (WSOW BR, Rebirth, Kill Race, Roulette) y configura partidas y equipos.
2. **Agregar participantes** — De forma individual o importando un archivo CSV/TXT con todos los jugadores.
3. **Generar bracket automático** — El sistema ordena los seeds y genera la llave según el formato.
4. **Cargar resultados** por tres vías:
   - ✍️ **Manual**: Ingresa kills y colocaciones directamente.
   - 📷 **OCR de imagen**: Sube un screenshot del scoreboard y el sistema extrae los datos automáticamente.
   - 📄 **CSV/TXT**: Importación masiva de resultados.
5. **Ver standings/bracket** — El leaderboard se actualiza en tiempo real con puntuación acumulada.
6. **Stream Hub** — Accede al panel de visualización para OBS y castea el torneo en vivo.

---

## 🏟️ Formatos de Torneo Soportados

### 🔫 WSOW BR (`wsow_br`)
Battle Royale con puntuación de colocación. Equipos fijos de 3 jugadores, lobby de 50 squads. Los puntos se calculan como `kills × multiplicador de placement` (x2.0 en primer lugar hasta x1.0 en puestos 36-50). Vista principal: standings acumulativos.

### 🏝️ Rebirth (`rebirth_ws`)
Modo Resurgence/Rebirth con puntuación específica. Equipos fijos de 3 jugadores, lobby de 16-17 equipos. Multiplicadores ajustados al ritmo del modo Rebirth. Vista principal: standings.

### ⚔️ Kill Race Bracket (`kill_race_bracket`)
Formato 1v1, 2v2 o 3v3 en series BO3. Equipos generados por ruleta. La pantalla principal es la llave (bracket), no standings. El ganador de más kills en la serie avanza.

### 🎰 Roulette (`roulette_ws`)
Equipos generados automáticamente por ruleta antes de cada partida. Usa multiplicadores BR o Rebirth según configuración. Vista principal: standings.

> 📄 Ver detalles completos de reglas y multiplicadores en [`app/docs/TOURNAMENT_RULES.md`](app/docs/TOURNAMENT_RULES.md)

---

## 📷 Sistema OCR & Visión

BracketFlow integra **OpenAI GPT-4o Vision** para extraer automáticamente los datos de scoreboards a partir de capturas de pantalla:

1. **Sube la imagen** del scoreboard (PNG, JPG o WEBP, máx. 8 MB).
2. El sistema envía la imagen a la **API de OpenAI** con contexto del torneo y la partida.
3. Se extraen kills, colocaciones y nombres de jugadores con detección de confianza y warnings.
4. El operador **revisa el draft** generado antes de confirmar los resultados.
5. Si el OCR no está disponible o falla, el sistema hace **fallback a entrada manual**.

```
GET  /ocr/provider                                           → Estado del proveedor OCR
POST /tournaments/{tournament_id}/matches/{match_id}/ocr/extract → Procesar imagen
```

> Si `OPENAI_API_KEY` no está configurada, el OCR se deshabilita automáticamente y todos los flujos de entrada manual siguen funcionando.

---

## 📡 Referencia de API

La documentación interactiva completa está en `http://localhost:8000/docs` (Swagger UI).

| Dominio | Prefijo |
|---------|---------|
| Torneos | `GET/POST /tournaments` |
| Equipos y Jugadores | `/tournaments/{id}/teams`, `/tournaments/{id}/participants` |
| Brackets y Matches | `/tournaments/{id}/bracket`, `/tournaments/{id}/matches` |
| Resultados | `/tournaments/{id}/matches/{match_id}/results` |
| Leaderboard | `GET /tournaments/{id}/leaderboard` |
| OCR | `GET /ocr/provider`, `POST .../ocr/extract` |
| Importación | `POST /tournaments/{id}/participants/import` |

---

## 🗺️ Roadmap

### Próximamente

- [ ] 🤖 **Bracket Copilot** — Agente de IA conversacional para crear y gestionar torneos automáticamente. El copiloto guía al organizador paso a paso, sugiere configuraciones, detecta conflictos y completa tareas operativas con lenguaje natural.
- [ ] 🎮 **Bot de Discord** — Integración nativa con Discord: notificaciones en tiempo real, comandos de consulta (`/standings`, `/bracket`, `/next-match`), gestión de registros y actualizaciones automáticas de resultados directamente en el servidor de Discord del torneo.
- [ ] 🎥 **Stream Hub / Caster integrado** — Sistema de casting en tiempo real construido dentro de BracketFlow. El propio sistema genera automáticamente el link de overlay para OBS sin configuración manual ni herramientas externas; el caster obtiene vistas sincronizadas de bracket, standings y kills en vivo.
- [ ] 📊 **Estadísticas avanzadas por jugador** por partida (K/D, daño, racha, etc.)
- [ ] 🔁 **Re-brackets automático** — regeneración de llaves ante abandonos o descalificaciones
- [ ] 🌍 **Soporte multi-idioma** (EN/ES)
- [ ] 👁️ **Dashboard de espectador** con vista en vivo para audiencia

---

## 📚 Documentación Adicional

| Archivo | Descripción |
|---------|-------------|
| [`app/docs/TOURNAMENT_RULES.md`](app/docs/TOURNAMENT_RULES.md) | Reglas y multiplicadores de cada motor de torneo |
| [`app/docs/TOURNAMENT_MODEL.md`](app/docs/TOURNAMENT_MODEL.md) | Modelo de datos y arquitectura |
| [`app/docs/NEXT_STEPS.md`](app/docs/NEXT_STEPS.md) | Próximos pasos de desarrollo |

---

## 📄 Licencia

Este proyecto está bajo una licencia privada. Todos los derechos reservados © BracketFlow.

---

<p align="center">Hecho con ❤️ para la comunidad de torneos de videojuegos</p>
