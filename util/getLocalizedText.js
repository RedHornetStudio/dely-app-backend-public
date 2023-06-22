const text = {
  en: {
    order: 'Order',
    orderReady: 'Order ready!',
    newOrder: 'New order',
    orderNumber: 'Order number',
    orderWillBeReady: 'Order will be ready after about',
    and: 'and',
    hours: 'hours',
    hour: 'hour',
    minutes: 'minutes',
    minute: 'minute',
    yourNewPassword: 'Your new password for Dely app',
    signInWithNewPassword: 'Sign in with password presented below. After successful sign in change the password.',
  },
  ru: {
    order: 'Заказ',
    orderReady: 'Заказ готов!',
    newOrder: 'Новый заказ',
    orderNumber: 'Номер заказа',
    orderWillBeReady: 'Заказ будет готов примерно через',
    and: 'и',
    hours: 'часа',
    hour: 'час',
    minutes: 'минут',
    minute: 'минуту',
    yourNewPassword: 'Ваш новый пароль для приложения Dely',
    signInWithNewPassword: 'Войдите с паролем, представленным ниже. После успешного входа смените пароль.',
  },
  lv: {
    order: 'Pasūtījums',
    orderReady: 'Pasūtījums gatavs!',
    newOrder: 'Jauns pasūtījums',
    orderNumber: 'Pasūtījuma numurs',
    orderWillBeReady: 'Pasūtījums būs gatavs apmēram pēc',
    and: 'un',
    hours: 'stundām',
    hour: 'stundas',
    minutes: 'minūtēm',
    minute: 'minūtes',
    yourNewPassword: 'Jūsu jaunā parole Dely aplikācijai',
    signInWithNewPassword: 'Pieslēdzieties ar zemāk norādīto paroli. Pēc veiksmīgas pieslēgšanas izmainiet paroli.',
  },
}

exports.getLocalizedText = language => {
  return text[language];
};