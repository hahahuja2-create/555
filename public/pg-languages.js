'use strict';

// Native names make the language selector usable before a translation is loaded.
const PORTGAINY_LANGUAGES = Object.freeze([
  ['en', 'English'], ['ka', 'ქართული'], ['es', 'Español'], ['fr', 'Français'],
  ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português'], ['tr', 'Türkçe'],
  ['ru', 'Русский'], ['uk', 'Українська'], ['ar', 'العربية'], ['fa', 'فارسی'],
  ['hi', 'हिन्दी'], ['bn', 'বাংলা'], ['id', 'Bahasa Indonesia'], ['vi', 'Tiếng Việt'],
  ['th', 'ไทย'], ['zh-CN', '简体中文'], ['ja', '日本語'], ['ko', '한국어'],
  ['nl', 'Nederlands'], ['pl', 'Polski'], ['ro', 'Română'], ['el', 'Ελληνικά'],
  ['cs', 'Čeština'], ['hu', 'Magyar'], ['sw', 'Kiswahili']
].map(([code, name]) => Object.freeze({ code, name })));

if (typeof module !== 'undefined' && module.exports) module.exports = PORTGAINY_LANGUAGES;
