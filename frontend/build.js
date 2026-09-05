// Vercel 빌드 시 실행되어 API_BASE_URL 환경변수 값을 config.js에 주입한다.
// 로컬 개발(빌드 없이 index.html 바로 열기)에서는 저장소에 커밋된 기본 config.js가 그대로 쓰인다.
const fs = require("fs");
const path = require("path");

const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:8000";

const content = `// 빌드 시 자동 생성됨 (frontend/build.js) — Vercel의 API_BASE_URL 환경변수 값을 주입한다.
window.APP_CONFIG = {
  API_BASE_URL: "${apiBaseUrl}",
};
`;

fs.writeFileSync(path.join(__dirname, "config.js"), content);
console.log("config.js generated with API_BASE_URL =", apiBaseUrl);
