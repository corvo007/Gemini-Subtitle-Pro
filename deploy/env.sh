#!/bin/sh
cat <<EOF > /usr/share/nginx/html/env-config.js
window.env = {
  GEMINI_API_KEY: "${GEMINI_API_KEY}",
  OPENAI_API_KEY: "${OPENAI_API_KEY}"
};
EOF
