/**
 * utils.js - 공용 유틸리티
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * innerHTML 템플릿에 사용자 입력(이름, 별명, 프리셋명 등)을 넣기 전 반드시 이스케이프
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}
