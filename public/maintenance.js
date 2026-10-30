'use strict';

(() => {
  const copy = {
    ka: { language: 'ენა', status: 'ახალი მისამართი', title: 'ჩვენ Portgainy‑ზე გადავედით', description: 'პლატფორმა მუშაობას ახალ საიტზე აგრძელებს. თქვენი ანგარიში და თანხები შენარჩუნებულია.', accountTitle: 'თქვენი ანგარიში შენარჩუნებულია', accountDetail: 'Portgainy‑ზე შესასვლელად გამოიყენეთ თქვენი არსებული ელფოსტა და პაროლი.', action: 'გადასვლა Portgainy‑ზე' },
    en: { language: 'Language', status: 'A new address', title: 'We have moved to Portgainy', description: 'The platform is now on a new website. Your account and funds have been preserved.', accountTitle: 'Your account is ready', accountDetail: 'Use your existing email and password to sign in to Portgainy.', action: 'Continue to Portgainy' },
    es: { language: 'Idioma', status: 'Una nueva dirección', title: 'Nos hemos trasladado a Portgainy', description: 'La plataforma continúa en un nuevo sitio web. Tu cuenta y tus fondos se han conservado.', accountTitle: 'Tu cuenta está lista', accountDetail: 'Utiliza tu correo electrónico y contraseña actuales para iniciar sesión en Portgainy.', action: 'Ir a Portgainy' },
    fr: { language: 'Langue', status: 'Une nouvelle adresse', title: 'Nous avons déménagé sur Portgainy', description: 'La plateforme est désormais sur un nouveau site. Votre compte et vos fonds ont été conservés.', accountTitle: 'Votre compte est prêt', accountDetail: 'Utilisez votre adresse e-mail et votre mot de passe habituels pour vous connecter à Portgainy.', action: 'Accéder à Portgainy' },
    de: { language: 'Sprache', status: 'Eine neue Adresse', title: 'Wir sind zu Portgainy umgezogen', description: 'Die Plattform ist jetzt auf einer neuen Website. Ihr Konto und Ihr Guthaben bleiben erhalten.', accountTitle: 'Ihr Konto ist bereit', accountDetail: 'Melden Sie sich bei Portgainy mit Ihrer bisherigen E-Mail-Adresse und Ihrem Passwort an.', action: 'Weiter zu Portgainy' },
    ru: { language: 'Язык', status: 'Новый адрес', title: 'Мы переехали на Portgainy', description: 'Платформа продолжает работу на новом сайте. Ваш аккаунт и средства сохранены.', accountTitle: 'Ваш аккаунт сохранён', accountDetail: 'Войдите в Portgainy с помощью прежних электронной почты и пароля.', action: 'Перейти на Portgainy' },
    tr: { language: 'Dil', status: 'Yeni bir adres', title: 'Portgainy’ye taşındık', description: 'Platform artık yeni bir web sitesinde. Hesabınız ve bakiyeniz korunmuştur.', accountTitle: 'Hesabınız hazır', accountDetail: 'Portgainy’ye giriş yapmak için mevcut e-posta adresinizi ve şifrenizi kullanın.', action: 'Portgainy’ye geç' },
    ar: { language: 'اللغة', status: 'عنوان جديد', title: 'انتقلنا إلى Portgainy', description: 'تعمل المنصة الآن على موقع جديد. تم الاحتفاظ بحسابك وأموالك.', accountTitle: 'حسابك محفوظ', accountDetail: 'استخدم بريدك الإلكتروني وكلمة المرور الحاليين لتسجيل الدخول إلى Portgainy.', action: 'الانتقال إلى Portgainy' },
    hi: { language: 'भाषा', status: 'नया पता', title: 'हम Portgainy पर आ गए हैं', description: 'प्लेटफ़ॉर्म अब एक नई वेबसाइट पर है। आपका खाता और धन सुरक्षित रखे गए हैं।', accountTitle: 'आपका खाता सुरक्षित है', accountDetail: 'Portgainy में साइन इन करने के लिए अपना मौजूदा ईमेल और पासवर्ड इस्तेमाल करें।', action: 'Portgainy पर जाएँ' },
    zh: { language: '语言', status: '新地址', title: '我们已迁至 Portgainy', description: '平台现已迁至新网站。您的账户和资金均已保留。', accountTitle: '您的账户已保留', accountDetail: '请使用现有邮箱和密码登录 Portgainy。', action: '前往 Portgainy' }
  };
  const select = document.querySelector('#maintenance-language');
  let language = 'ka';
  try { const saved = localStorage.getItem('taskmall_language'); if (Object.hasOwn(copy, saved)) language = saved; } catch {}
  function render() {
    const text = copy[language];
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = `TaskMall | ${text.title}`;
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
  const referral = new URLSearchParams(location.search).get('ref');
  if (referral && /^[A-Za-z0-9_-]{1,24}$/.test(referral)) {
    const destination = new URL('https://portgainy.com/');
    destination.searchParams.set('ref', referral);
    document.querySelector('#destination-link').href = destination.href;
  }
  render();
})();
