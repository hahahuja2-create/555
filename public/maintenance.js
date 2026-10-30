'use strict';

(() => {
  const copy = {
    ka: { language: 'ენა', status: 'დაგეგმილი ტექნიკური სამუშაოები', title: 'პლატფორმა დროებით მიუწვდომელია', description: 'პლატფორმაზე მიმდინარეობს დაგეგმილი ტექნიკური სამუშაოები სერვისის განახლებისა და სტაბილურობის გაუმჯობესებისთვის.', resumeLabel: 'პლატფორმა მუშაობას განაახლებს', date: '31 ოქტომბერს, 18:00-ზე', thanks: 'გმადლობთ მოთმინებისა და გაგებისთვის.' },
    en: { language: 'Language', status: 'Scheduled maintenance', title: 'The platform is temporarily unavailable', description: 'We are carrying out scheduled maintenance to update our services and improve platform stability.', resumeLabel: 'The platform will resume operations on', date: '31 October at 18:00', thanks: 'Thank you for your patience and understanding.' },
    es: { language: 'Idioma', status: 'Mantenimiento programado', title: 'La plataforma no está disponible temporalmente', description: 'Estamos realizando un mantenimiento programado para actualizar nuestros servicios y mejorar la estabilidad de la plataforma.', resumeLabel: 'La plataforma reanudará su funcionamiento el', date: '31 de octubre a las 18:00', thanks: 'Gracias por su paciencia y comprensión.' },
    fr: { language: 'Langue', status: 'Maintenance programmée', title: 'La plateforme est temporairement indisponible', description: 'Nous effectuons une maintenance programmée afin de mettre à jour nos services et d’améliorer la stabilité de la plateforme.', resumeLabel: 'La plateforme reprendra ses activités le', date: '31 octobre à 18:00', thanks: 'Merci pour votre patience et votre compréhension.' },
    de: { language: 'Sprache', status: 'Geplante Wartungsarbeiten', title: 'Die Plattform ist vorübergehend nicht verfügbar', description: 'Wir führen geplante Wartungsarbeiten durch, um unsere Dienste zu aktualisieren und die Stabilität der Plattform zu verbessern.', resumeLabel: 'Die Plattform ist wieder verfügbar am', date: '31. Oktober um 18:00', thanks: 'Vielen Dank für Ihre Geduld und Ihr Verständnis.' },
    ru: { language: 'Язык', status: 'Плановые технические работы', title: 'Платформа временно недоступна', description: 'Мы проводим плановые технические работы для обновления сервисов и повышения стабильности платформы.', resumeLabel: 'Платформа возобновит работу', date: '31 октября в 18:00', thanks: 'Благодарим за терпение и понимание.' },
    tr: { language: 'Dil', status: 'Planlı bakım çalışmaları', title: 'Platform geçici olarak kullanılamıyor', description: 'Hizmetlerimizi güncellemek ve platformun kararlılığını artırmak için planlı bakım çalışmaları yürütüyoruz.', resumeLabel: 'Platformun yeniden açılacağı tarih', date: '31 Ekim, 18:00', thanks: 'Sabrınız ve anlayışınız için teşekkür ederiz.' },
    ar: { language: 'اللغة', status: 'صيانة مجدولة', title: 'المنصة غير متاحة مؤقتًا', description: 'نجري أعمال صيانة مجدولة لتحديث خدماتنا وتحسين استقرار المنصة.', resumeLabel: 'تستأنف المنصة عملها في', date: '31 أكتوبر الساعة 18:00', thanks: 'شكرًا لصبركم وتفهمكم.' },
    hi: { language: 'भाषा', status: 'निर्धारित रखरखाव', title: 'प्लेटफ़ॉर्म अस्थायी रूप से उपलब्ध नहीं है', description: 'हम अपनी सेवाओं को अपडेट करने और प्लेटफ़ॉर्म की स्थिरता बेहतर बनाने के लिए निर्धारित रखरखाव कर रहे हैं।', resumeLabel: 'प्लेटफ़ॉर्म फिर से काम शुरू करेगा', date: '31 अक्टूबर को 18:00 बजे', thanks: 'आपके धैर्य और समझ के लिए धन्यवाद।' },
    zh: { language: '语言', status: '计划维护', title: '平台暂时无法使用', description: '我们正在进行计划维护，以更新服务并提升平台稳定性。', resumeLabel: '平台将于以下时间恢复运行', date: '10月31日 18:00', thanks: '感谢您的耐心等待与理解。' }
  };
  const select = document.querySelector('#maintenance-language');
  let language = 'ka';
  try { const saved = localStorage.getItem('taskmall_language'); if (Object.hasOwn(copy, saved)) language = saved; } catch {}
  function render() {
    const text = copy[language];
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = `TaskMall | ${text.status}`;
    document.querySelectorAll('[data-copy]').forEach(element => { element.textContent = text[element.dataset.copy]; });
    select.value = language;
  }
  select.addEventListener('change', () => {
    if (!Object.hasOwn(copy, select.value)) return;
    language = select.value;
    try { localStorage.setItem('taskmall_language', language); } catch {}
    render();
  });
  window.addEventListener('storage', event => {
    if (event.key === 'taskmall_language' && Object.hasOwn(copy, event.newValue)) { language = event.newValue; render(); }
  });
  async function checkStatus() {
    try {
      const response = await fetch('/api/maintenance', { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const status = await response.json();
      if (status.active === false) {
        if (location.pathname === '/maintenance.html') location.replace('/' + location.search + location.hash);
        else location.reload();
      }
    } catch {}
  }
  render();
  checkStatus();
  setInterval(checkStatus, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkStatus(); });
})();
