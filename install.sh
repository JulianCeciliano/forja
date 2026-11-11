#!/usr/bin/env bash
# Forja 0.3.0 — instalador de un solo comando (idempotente). Sirve en macOS, Linux y Git Bash (Windows).
#
#   Desde un clon:      ./install.sh [opciones]            (en la raíz de tu proyecto Laravel)
#   Sin clonar:         curl -fsSL https://raw.githubusercontent.com/JulianCeciliano/forja/main/install.sh | FORJA_REPO=JulianCeciliano/forja bash -s -- [opciones]
#
# Opciones:
#   --new NOMBRE          crea un proyecto Laravel nuevo (starter kit React, sin preguntas) y entra en él
#   --full                atajo recomendado: Boost + --with-mcp + --with-playwright + --with-lsp + --with-frontend-design
#                         (NO incluye superpowers, caveman ni graphify)
#   --with-mcp            registra Context7 y Chrome DevTools MCP a nivel de proyecto
#   --with-playwright     Playwright CLI + sus skills (lo que usa el agente qa; más barato en tokens que el MCP)
#   --with-playwright-mcp además, Playwright MCP (solo para exploración larga con estado de navegador)
#   --with-lsp            plugins php-lsp y typescript-lsp (+ intelephense y typescript-language-server vía npm)
#   --with-frontend-design  plugin oficial frontend-design de Anthropic
#   --with-graphify       Graphify (grafo del código). Opt-in: mide su ahorro con el A/B
#   --with-caveman        plugin Caveman (respuestas cortas). Opt-in: mide su ahorro con el A/B
#   --with-superpowers    plugin Superpowers (opt-in: inyecta su skill en cada sesión y choca con "una skill dueña por fase")
#   --boost-update-hook   añade `boost:update` a post-update-cmd de composer.json (no se impone nunca por defecto)
#   --no-boost            no instala Laravel Boost
#   --no-superpowers      OBSOLETO: ya no se instala por defecto; no hace nada
#   --files-only          solo copia la capa de archivos del proyecto (sin llamar al CLI de claude)
#   --dry-run             muestra lo que haría sin ejecutar nada
set -euo pipefail

DRY=0; FILES_ONLY=0; NEW=""; GRAPHIFY=0; CAVEMAN=0; MCP=0; PLAYWRIGHT=0; PLAYWRIGHT_MCP=0
LSP=0; FRONTEND=0; BOOST=1; SUPERPOWERS=0; BOOST_HOOK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --new) NEW="${2:?falta el nombre del proyecto}"; shift ;;
    --full) MCP=1; PLAYWRIGHT=1; LSP=1; FRONTEND=1 ;;
    --with-graphify) GRAPHIFY=1 ;;
    --with-caveman) CAVEMAN=1 ;;
    --with-mcp) MCP=1 ;;
    --with-playwright) PLAYWRIGHT=1 ;;
    --with-playwright-mcp) PLAYWRIGHT_MCP=1 ;;
    --with-lsp) LSP=1 ;;
    --with-frontend-design) FRONTEND=1 ;;
    --with-superpowers) SUPERPOWERS=1 ;;
    --boost-update-hook) BOOST_HOOK=1 ;;
    --no-boost) BOOST=0 ;;
    --no-superpowers) echo "aviso: --no-superpowers está obsoleto (Superpowers ya es opt-in con --with-superpowers); se ignora." >&2 ;;
    --files-only) FILES_ONLY=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "opción desconocida: $1" >&2; exit 1 ;;
  esac
  shift
done

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*" >&2; }
run()  { if [ "$DRY" = 1 ]; then printf '   [dry-run] %s\n' "$*"; else "$@"; fi; }
# Pasos opcionales: si fallan, avisa con el comando manual y sigue.
try()  { if [ "$DRY" = 1 ]; then printf '   [dry-run] %s\n' "$*"; elif ! "$@"; then warn "falló: $* (puedes repetirlo a mano)"; fi; }
need() { command -v "$1" >/dev/null 2>&1 || { warn "falta '$1' en el PATH"; return 1; }; }
# ¿Hay un terminal interactivo al que conectar un comando que pregunta? (falso en `curl | bash` sin tty, CI, etc.)
has_tty() { { [ -t 0 ] && [ -t 1 ]; } || { (: </dev/tty) 2>/dev/null; }; }
# Ejecuta un comando interactivo conectándolo al terminal real aunque stdin sea un pipe.
run_tty() {
  if [ "$DRY" = 1 ]; then printf '   [dry-run] %s\n' "$*"; return 0; fi
  if [ -t 0 ]; then "$@"; else "$@" </dev/tty; fi
}

# --- origen de los archivos del plugin ---
SELF="${BASH_SOURCE[0]:-}"
SCRIPT_DIR=""
[ -n "$SELF" ] && [ -f "$SELF" ] && SCRIPT_DIR="$(cd "$(dirname "$SELF")" && pwd)"
if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/.claude-plugin/plugin.json" ]; then
  SRC="$SCRIPT_DIR"; MKT_SOURCE="$SCRIPT_DIR"
else
  : "${FORJA_REPO:?Ejecutaste el script sin clon: define FORJA_REPO=JulianCeciliano/forja}"
  need git || exit 1
  SRC="$(mktemp -d)"; MKT_SOURCE="$FORJA_REPO"
  say "Descargando $FORJA_REPO"
  git clone --depth 1 "https://github.com/$FORJA_REPO.git" "$SRC" >/dev/null 2>&1 || { warn "no pude clonar $FORJA_REPO"; exit 1; }
fi

say "Comprobando requisitos"
need node || exit 1
need git  || exit 1
if [ "$FILES_ONLY" = 0 ] && [ "$DRY" = 0 ]; then need claude || { warn "instala Claude Code o usa --files-only"; exit 1; }; fi

# --- proyecto nuevo ---
BOOST_DONE=0
if [ -n "$NEW" ]; then
  # Flags verificados en https://laravel.com/for/agents (laravel new ... --react --npm --boost --no-interaction).
  say "Creando proyecto Laravel '$NEW' (starter kit React/Inertia, SQLite, npm, Boost; sin preguntas)"
  if command -v laravel >/dev/null 2>&1; then
    BOOST_FLAG="--boost"; [ "$BOOST" = 1 ] || BOOST_FLAG=""
    # shellcheck disable=SC2086
    run laravel new "$NEW" --database=sqlite --react --npm $BOOST_FLAG --no-interaction
    [ "$BOOST" = 1 ] && BOOST_DONE=1
  else
    warn "no hay 'laravel' (instálalo con: composer global require laravel/installer); uso composer create-project, sin starter kit React."
    [ "$DRY" = 1 ] || need composer || exit 1
    run composer create-project laravel/laravel "$NEW"
  fi
  [ "$DRY" = 1 ] || cd "$NEW"
fi
PROJECT="$PWD"
HAS_ARTISAN=0; [ -f artisan ] && HAS_ARTISAN=1
# En --dry-run con --new el proyecto aún no existe: se asume Laravel para mostrar el plan completo.
[ -n "$NEW" ] && [ "$DRY" = 1 ] && HAS_ARTISAN=1
[ "$HAS_ARTISAN" = 1 ] || warn "no veo 'artisan' aquí: instalo solo la capa Forja (sin Boost)."

# --- Laravel Boost (MCP + guías + skills oficiales de Laravel) ---
# `boost:install` es interactivo: solo se lanza con terminal. Sin terminal (curl | bash, CI) se deja el comando manual.
if [ "$BOOST" = 1 ] && [ "$HAS_ARTISAN" = 1 ] && [ "$FILES_ONLY" = 0 ] && [ "$BOOST_DONE" = 0 ]; then
  say "Laravel Boost"
  if [ "$DRY" = 1 ] || need composer; then
    try composer require laravel/boost --dev
    if [ -f boost.json ] && [ "$DRY" = 0 ]; then
      say "Boost ya estaba configurado (boost.json): sincroniza con: php artisan boost:update"
    elif [ "$DRY" = 1 ] || has_tty; then
      say "boost:install es interactivo: elige Claude Code y marca las skills (se cargan bajo demanda, cuestan menos que las guías)"
      if ! run_tty php artisan boost:install; then warn "boost:install no terminó; repítelo a mano: php artisan boost:install"; fi
    else
      warn "sin terminal interactivo: no lanzo boost:install. Ejecútalo tú: php artisan boost:install  (elige Claude Code e instala las skills)"
    fi
  fi
elif [ "$BOOST_DONE" = 1 ]; then
  say "Laravel Boost ya instalado por 'laravel new --boost'. Para sincronizarlo más tarde: php artisan boost:update"
fi

if [ "$BOOST_HOOK" = 1 ] && [ "$HAS_ARTISAN" = 1 ]; then
  say "Añadiendo boost:update a post-update-cmd de composer.json (opt-in)"
  if [ "$DRY" = 1 ]; then printf '   [dry-run] node install-files.mjs --boost-hook\n'; else node "$SRC/scripts/install-files.mjs" "$PROJECT" --boost-hook-only; fi
fi

# --- capa de archivos del proyecto ---
say "Copiando la capa Forja al proyecto"
if [ "$DRY" = 1 ]; then node "$SRC/scripts/install-files.mjs" "$PROJECT" --dry; else node "$SRC/scripts/install-files.mjs" "$PROJECT"; fi

if [ "$FILES_ONLY" = 1 ]; then say "Listo (--files-only). Instala el plugin con: claude plugin marketplace add '$MKT_SOURCE' && claude plugin install forja@forja"; exit 0; fi

# --- plugins ---
say "Instalando el plugin forja"
# Un clon local se registra con ruta absoluta: scope "local" (no versionado). Un repo de GitHub sí es portable: "project".
if [ "$MKT_SOURCE" = "${SCRIPT_DIR:-__none__}" ]; then FORJA_SCOPE=local; else FORJA_SCOPE=project; fi
try claude plugin marketplace add "$MKT_SOURCE" --scope "$FORJA_SCOPE"
try claude plugin install forja@forja --scope "$FORJA_SCOPE"

OFFICIAL_ADDED=0
official_marketplace() {
  [ "$OFFICIAL_ADDED" = 1 ] && return 0
  try claude plugin marketplace add anthropics/claude-plugins-official --scope project
  OFFICIAL_ADDED=1
}

if [ "$SUPERPOWERS" = 1 ]; then
  say "Superpowers (opt-in; inyecta su skill en cada sesión: mide el coste con el A/B)"
  official_marketplace
  try claude plugin install superpowers@claude-plugins-official --scope project
fi

if [ "$LSP" = 1 ]; then
  # Los plugins LSP solo configuran el servidor; el binario va aparte (https://code.claude.com/docs/en/plugins/code-intelligence).
  say "Code intelligence: php-lsp (intelephense) y typescript-lsp"
  need npm || warn "sin npm no puedo instalar los servidores de lenguaje; instálalos a mano."
  try npm install -g intelephense
  try npm install -g typescript-language-server typescript
  official_marketplace
  try claude plugin install php-lsp@claude-plugins-official --scope user
  try claude plugin install typescript-lsp@claude-plugins-official --scope user
fi

if [ "$FRONTEND" = 1 ]; then
  say "frontend-design (plugin oficial de Anthropic)"
  official_marketplace
  try claude plugin install frontend-design@claude-plugins-official --scope project
fi

if [ "$CAVEMAN" = 1 ]; then
  say "Caveman (respuestas cortas). Tras instalar, mide con /caveman-stats"
  try claude plugin marketplace add JuliusBrussee/caveman --scope project
  try claude plugin install caveman@caveman --scope project
fi

if [ "$GRAPHIFY" = 1 ]; then
  say "Graphify (grafo del código)"
  [ -f .graphifyignore ] || { [ "$DRY" = 1 ] || printf 'vendor/\nnode_modules/\nstorage/\npublic/build/\nbootstrap/cache/\n.git/\n' > .graphifyignore; }
  if command -v pipx >/dev/null 2>&1; then try pipx install graphifyy; else try pip install graphifyy; fi
  try graphify claude install
  try graphify hook install
  try graphify update .
fi

if [ "$MCP" = 1 ]; then
  say "MCP: Context7 y Chrome DevTools"
  # Forma remota (http) de la doc de Context7; sin API key. Con clave: añade --header "Authorization: Bearer <KEY>" (https://context7.com/docs/resources/all-clients).
  try claude mcp add --scope project --transport http context7 https://mcp.context7.com/mcp
  try claude mcp add --scope project chrome-devtools -- npx -y chrome-devtools-mcp@latest
  case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) warn "Windows nativo: si un MCP con npx no conecta (/mcp), la doc de Context7 usa 'cmd /c npx ...' como comando; no verificado en la doc de Claude Code." ;; esac
fi

if [ "$PLAYWRIGHT" = 1 ]; then
  say "Playwright CLI (navegador para el agente qa: salida concisa, skills bajo demanda)"
  try npm install -g @playwright/cli@latest
  try playwright-cli install --skills
  try playwright-cli install-browser chromium   # no documentado en el README de @playwright/cli: si falla, usa un Chrome instalado (playwright-cli open --browser=chrome)
fi

if [ "$PLAYWRIGHT_MCP" = 1 ]; then
  say "Playwright MCP (opt-in: esquemas y snapshots viven en el contexto)"
  try claude mcp add --scope project playwright -- npx @playwright/mcp@latest
fi

cat <<'EOF'

Listo. Abre Claude Code en este proyecto y:
  1. /forja:triage <tu tarea>      enruta por tipo de tarea (sistema nuevo, bug, feature, UI, infra, QA...)
  2. L2: /forja:idea <idea>  →  /forja:approve spec  →  /forja:design  →  /forja:build  →  /forja:approve plan
  3. /forja:verify  →  /forja:ship  →  /forja:retro
Estado: node .forja/forja.mjs status   ·   Tokens: node .forja/forja.mjs metrics   ·   Coste: /usage
Opcional: las trampas del repo van en .ai/rules (Boost, herramienta record-rule), no en CLAUDE.md.
EOF
