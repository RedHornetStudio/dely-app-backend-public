const pool = require('../util/database');
var bigDecimal = require('js-big-decimal');
const { Expo } = require('expo-server-sdk');

const { getRandomIntInclusive } = require('../util/functions');
const { jwtVerifyAsync } = require('../util/functions');
const { getLocalizedText } = require('../util/getLocalizedText');

module.exports = class Order {
  constructor(locationId, currency, deliveryMethodDetails, deliveryPrice, shoppingCartItems, pushToken, language) {
    this.locationId = locationId;
    this.currency = typeof currency !== 'string' ? currency : currency.trim();
    this.deliveryMethodDetails = deliveryMethodDetails;
    this.deliveryPrice = deliveryPrice;
    this.shoppingCartItems = shoppingCartItems;
    this.pushToken = pushToken;
    this.language = typeof language !== 'string' ? language : language.trim();
  }

  async postOrderAsync() {
    const locationId = this.locationId;
    const currency = this.currency
    const deliveryMethodDetails = this.deliveryMethodDetails;
    const deliveryPrice = this.deliveryPrice;
    const shoppingCartItems = this.shoppingCartItems;
    const pushToken = this.pushToken
    const language = this.language;

    // check request body validity
    if (typeof locationId !== 'number' || typeof currency !== 'string' || typeof deliveryMethodDetails !== 'object' || typeof deliveryPrice !== 'string' || typeof shoppingCartItems !== 'object' || typeof pushToken !== 'string' || typeof language !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    const errors = [];
    if (deliveryMethodDetails.deliveryMethod === 'delivery') {
      // check phoneNumber input field
      if (deliveryMethodDetails.phoneNumber.length === 0) {
        errors.push({ value: deliveryMethodDetails.phoneNumber, param: 'phoneNumber', msg: 'Empty value' });
      } else if (!/^\+?[0-9]+$/.test(deliveryMethodDetails.phoneNumber)) {
        errors.push({ value: deliveryMethodDetails.phoneNumber, param: 'phoneNumber', msg: 'Invalid value' });
      }
      // check address input field
      if (deliveryMethodDetails.address.length === 0) {
        errors.push({ value: deliveryMethodDetails.address, param: 'address', msg: 'Empty value' });
      }
    } else {
      // check phoneNumber input field
      if (deliveryMethodDetails.phoneNumber.length === 0) {
        errors.push({ value: deliveryMethodDetails.phoneNumber, param: 'phoneNumber', msg: 'Empty value' });
      } else if (!/^\+?[0-9]+$/.test(deliveryMethodDetails.phoneNumber)) {
        errors.push({ value: deliveryMethodDetails.phoneNumber, param: 'phoneNumber', msg: 'Invalid value' });
      }
    }
    if (errors.length > 0) {
      return { errors: errors };
    }

    let totalPrice = new bigDecimal(0);
    shoppingCartItems.forEach(item => {
      const priceMultiplyByCount = new bigDecimal(item.price).multiply(new bigDecimal(item.count));
      totalPrice = totalPrice.add(priceMultiplyByCount);
    });
    totalPrice = totalPrice.add(new bigDecimal(deliveryPrice));
  
    const connection = await pool.getConnection();
    let orderId;
    let orderNumber;
    try {
      // Check if location exist and if it is opened
      const locations = (await connection.execute('SELECT id, time_zone FROM locations WHERE id = ?', [locationId]))[0];
      if (locations.length === 0) {
        return { errors: [{ msg: 'Location do not exist', locationId: locationId }] };
      }
      const workingHours = (await connection.execute('SELECT * FROM working_hours WHERE location_id = ?', [locations[0].id]))[0];
      const refactoredWorkingHours = {
        '0': workingHours[0].sunday,
        '1': workingHours[0].monday,
        '2': workingHours[0].tuesday,
        '3': workingHours[0].wednesday,
        '4': workingHours[0].thursday,
        '5': workingHours[0].friday,
        '6': workingHours[0].saturday
      };
      let shopOpened = false;
      const dateInSpecificTimeZone = new Date(new Date().toLocaleString('en-US', { timeZone: locations[0].time_zone }));
      let todayWorkingTimes = refactoredWorkingHours[dateInSpecificTimeZone.getDay()];;
      let yesterdayDayNumber = dateInSpecificTimeZone.getDay();
      yesterdayDayNumber === 0
        ? yesterdayDayNumber = 6
        : yesterdayDayNumber = yesterdayDayNumber - 1;
      const yesterdayWorkingTimes = refactoredWorkingHours[yesterdayDayNumber];
      if (yesterdayWorkingTimes !== 'closed') {
        const yesterdayOpenTime = yesterdayWorkingTimes.split('-')[0];
        const yesterdayCloseTime = yesterdayWorkingTimes.split('-')[1];
        let dateInSpecificTimeZoneHours = dateInSpecificTimeZone.getHours().toString();
        let dateInSpecificTimeZoneMinutes = dateInSpecificTimeZone.getMinutes().toString();
        dateInSpecificTimeZoneHours = dateInSpecificTimeZoneHours.length === 1 ? `0${dateInSpecificTimeZoneHours}` : dateInSpecificTimeZoneHours;
        dateInSpecificTimeZoneMinutes = dateInSpecificTimeZoneMinutes.length === 1 ? `0${dateInSpecificTimeZoneMinutes}` : dateInSpecificTimeZoneMinutes;
        const dateInSpecificTimeZoneTime = `${dateInSpecificTimeZoneHours}:${dateInSpecificTimeZoneMinutes}`;
        if (yesterdayCloseTime <= yesterdayOpenTime && yesterdayCloseTime !== '00:00' && dateInSpecificTimeZoneTime < yesterdayCloseTime) {
          shopOpened = true;
          todayWorkingTimes = yesterdayWorkingTimes;
        }
      }
      if (!shopOpened) {
        if (todayWorkingTimes !== 'closed') {
          const openTime = todayWorkingTimes.split('-')[0];
          const closeTime = todayWorkingTimes.split('-')[1];
          const openTimeDate = new Date(dateInSpecificTimeZone.getFullYear(), dateInSpecificTimeZone.getMonth(), dateInSpecificTimeZone.getDate(), parseInt(openTime.split(':')[0]), parseInt(openTime.split(':')[1]), 0);
          let closeTimeDate = null;
          closeTime <= openTime
            ? closeTimeDate = new Date(dateInSpecificTimeZone.getFullYear(), dateInSpecificTimeZone.getMonth(), dateInSpecificTimeZone.getDate(), 24, 0, 0)
            : closeTimeDate = new Date(dateInSpecificTimeZone.getFullYear(), dateInSpecificTimeZone.getMonth(), dateInSpecificTimeZone.getDate(), parseInt(closeTime.split(':')[0]), parseInt(closeTime.split(':')[1]), 0);
          shopOpened = dateInSpecificTimeZone.getTime() >= openTimeDate.getTime() && dateInSpecificTimeZone.getTime() <= closeTimeDate.getTime() ? true : false;
        }
      }
      if (!shopOpened) {
        return { errors: [{ msg: 'Location is closed', locationId: locationId }] };
      }

      // generating order number
      let orderNumberExists = true;
      while (orderNumberExists) {
        let number = getRandomIntInclusive(0, 99999).toString();
        while (number.length < 5) number = `0${number}`;
        const data = (await connection.execute('SELECT order_number FROM orders WHERE location_id = ? AND order_number = ?', [locationId, number]))[0];
        if (data.length === 0) {
          orderNumber = number;
          orderNumberExists = false;
        }
      }

      // inserting in orders table, order_items table, order_item_options table and order_selected_options table.
      try {
        await connection.query('START TRANSACTION');
        orderId = (await connection.execute('INSERT INTO orders (location_id, currency, order_number, total_price, delivery_method, delivery_price, buyer_name, phone_number, address, door_code, push_token, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [locationId, currency, orderNumber, totalPrice.round(2).getValue(), deliveryMethodDetails.deliveryMethod, new bigDecimal(deliveryPrice).round(2).getValue(), deliveryMethodDetails.name, deliveryMethodDetails.phoneNumber, deliveryMethodDetails.address, deliveryMethodDetails.doorCode, pushToken, language]))[0].insertId;
        for (let i = 0; i < shoppingCartItems.length; i++) {
          const orderItemId = (await connection.execute('INSERT INTO order_items (order_id, title, price, count) VALUES (?, ?, ?, ?)', [orderId, shoppingCartItems[i].title, shoppingCartItems[i].price, shoppingCartItems[i].count]))[0].insertId;
          for (let j = 0; j < shoppingCartItems[i].options.length; j++) {
            const orderItemOptionId = (await connection.execute('INSERT INTO order_item_options (order_item_id, title) VALUES (?, ?)', [orderItemId, shoppingCartItems[i].options[j].title]))[0].insertId;
            for (let k = 0; k < shoppingCartItems[i].options[j].selected.length; k++) {
              const selectedOptionId = (await connection.execute('INSERT INTO order_selected_options (order_item_option_id, title) VALUES (?, ?)', [orderItemOptionId, shoppingCartItems[i].options[j].selected[k]]))[0].insertId;
            }
          }
        }
        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      }
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  
    return {data: { msg: 'Product added successfully', orderId: orderId, orderNumber: orderNumber }};
  }

  static async getOrderUpdateAsync(orderId, orderNumber) {
    // check request body validity
    if (typeof orderId !== 'number' || typeof orderNumber !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }
  
    // getting order status from database
    const orderDetails = (await pool.execute('SELECT status FROM orders WHERE id = ? AND order_number = ?', [orderId, orderNumber]))[0][0];
    if (orderDetails) {
      return {data: { orderStatus: orderDetails.status }};
    }
    return {data: { orderStatus: 'closed' }};
  }

  static async getOrderDetailsAsync(orderId, orderNumber) {
    // check request body validity
    if (typeof orderId !== 'number' || typeof orderNumber !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }
  
    // getting order details from database
    const connection = await pool.getConnection();
    let orderData;
    try {
      const [[order]] = await connection.execute(`SELECT id, location_id, currency, status, total_price, delivery_method, delivery_price, buyer_name, phone_number, address, door_code, order_generation_time, time_sended FROM orders WHERE id = ? AND order_number = ?`, [orderId, orderNumber]);
      if (!order) return { errors: [{ msg: 'Order do not exist' }] };
      orderData = order;
      // getting order items
      const [items] = await connection.execute('SELECT id, title, price, count FROM order_items WHERE order_id = ?', [order.id]);
      orderData.items = items;
      // getting order items options
      for (let j = 0; j < items.length; j++) {
        const [options] = await connection.execute('SELECT id, title FROM order_item_options WHERE order_item_id = ?', [items[j].id]);
        orderData.items[j].options = options;
        // getting order items selected options
        for (let k = 0; k < options.length; k++) {
          const [selectedOptions] = await connection.execute('SELECT title FROM order_selected_options WHERE order_item_option_id = ?', [options[k].id]);
          orderData.items[j].options[k].selectedOptions = selectedOptions;
        }
      }

      const [[locationData]] = await connection.execute('SELECT shop_id, city, address FROM locations WHERE id = ?', [order.location_id]);
      const [[{ title: shopTitle }]] = await connection.execute('SELECT title FROM shops WHERE id = ?', [locationData.shop_id]);
      locationData.shopTitle = shopTitle;
      orderData.locationData = locationData;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: orderData };
  }

  static async getOrderHistoryAsync(orderHistory) {
    // check request body validity
    if (!Array.isArray(orderHistory)) {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // getting orders data
    const connection = await pool.getConnection();
    let ordersData = [];
    try {
      for (let i = 0; i < orderHistory.length; i++) {
        const [[order]] = await connection.execute('SELECT id, order_number, delivery_method, order_generation_time FROM orders WHERE id = ? AND order_number = ?', [orderHistory[i].id, orderHistory[i].number]);
        if (order) ordersData.push(order);
      }
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: ordersData };
  }

  static async getOrdersAsync(accessToken, locationId, filters, lastOrderGenerationTime) {
    // check request body validity
    if (typeof accessToken !== 'string' || typeof locationId !== 'number' || !Array.isArray(filters) || typeof lastOrderGenerationTime !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    // getting orders data
    if (filters.length === 0) return { data: [] };
    const connection = await pool.getConnection();
    let ordersData;
    try {
      // check if user is getting orders from shop to wich it belongs
      const [users] = await connection.execute('SELECT shop_id FROM business_users WHERE id = ?', [user.id]);
      if (users.length === 0) return { errors: [{ msg: 'Unauthorized' }] };
      const [locations] = await connection.execute('SELECT shop_id FROM locations WHERE id = ? AND shop_id = ?', [locationId, users[0].shop_id]);
      if (locations.length === 0) return { errors: [{ msg: 'Location do not exist', locationId: locationId }] };

      // getting orders
      let questionsString = '';
      const values = [];
      if (lastOrderGenerationTime.length > 0) {
        let lastOrderGenerationTimeInSeconds = new Date(lastOrderGenerationTime).getTime().toString();
        lastOrderGenerationTimeInSeconds = lastOrderGenerationTimeInSeconds.substring(0, lastOrderGenerationTimeInSeconds.length - 3) + '.' + lastOrderGenerationTimeInSeconds.substring(lastOrderGenerationTimeInSeconds.length - 3, lastOrderGenerationTimeInSeconds.length);
        values.push(locationId, lastOrderGenerationTimeInSeconds);
      } else {
        values.push(locationId);
      }
      filters.forEach((filter, index) => {
        values.push(filter);
        if (index === 0) {
          questionsString += '(?';
        } else {
          questionsString += ', ?'
        }
        if (index === filters.length - 1) questionsString += ')'
      });
      let orders
      lastOrderGenerationTime.length > 0
        ? [orders] = await connection.execute(`SELECT id, currency, order_number, delivery_method, status, total_price, delivery_price, order_generation_time, time_sended FROM orders WHERE location_id = ? AND STRCMP(UNIX_TIMESTAMP(order_generation_time), ?) > 0 AND status IN ${questionsString}`, values)
        : [orders] = await connection.execute(`SELECT id, currency, order_number, delivery_method, status, total_price, delivery_price, order_generation_time, time_sended FROM orders WHERE location_id = ? AND status IN ${questionsString}`, values);
      ordersData = orders;
      // getting orders items
      for (let i = 0; i < orders.length; i++) {
        const [items] = await connection.execute('SELECT id, title, price, count FROM order_items WHERE order_id = ?', [orders[i].id]);
        ordersData[i].items = items;
        // getting orders items options
        for (let j = 0; j < items.length; j++) {
          const [options] = await connection.execute('SELECT id FROM order_item_options WHERE order_item_id = ?', [items[j].id]);
          // ordersData[i].items[j].options = options;
          ordersData[i].items[j].selectedOptions = [];
          // getting orders items selected options
          for (let k = 0; k < options.length; k++) {
            const [selectedOptions] = await connection.execute('SELECT title FROM order_selected_options WHERE order_item_option_id = ?', [options[k].id]);
            selectedOptions.forEach((selectedOption => {
              ordersData[i].items[j].selectedOptions.push(selectedOption.title)
            }));
          }
        }
      }
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: ordersData };
  }

  static async postChangeOrderStatusAsync(accessToken, orderId, orderStatus) {
    // check request body validity
    if (typeof accessToken !== 'string' || typeof orderId !== 'number' || typeof orderStatus !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }
    if (orderStatus !== 'preparing' && orderStatus !== 'ready' && orderStatus !== 'closed') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }
  
    const connection = await pool.getConnection();
    let order
    try {
      // check if user is changing order status in shop to wich it belongs
      const [users] = await connection.execute('SELECT shop_id FROM business_users WHERE id = ?', [user.id]);
      if (users.length === 0) return { errors: [{ msg: 'Unauthorized' }] };
      const [orders] = await connection.execute('SELECT location_id FROM orders WHERE id = ?', [orderId]);
      if (orders.length === 0) return { errors: [{ msg: 'Order do not exist', orderId: orderId }] };
      const [locations] = await connection.execute('SELECT shop_id FROM locations WHERE id = ?', [orders[0].location_id]);
      if (users[0].shop_id !== locations[0].shop_id) return { errors: [{ msg: 'Order do not exist', orderId: orderId }] };

      // updating order status in database
      const [result] = (await connection.execute('UPDATE orders SET status = ? WHERE id = ?', [orderStatus, orderId]));
      if (result.affectedRows === 0) return { errors: [{ msg: 'Order do not exist', orderId: orderId }] };

      // getting orderNumber and deliveryMethod
      [[order]] = (await connection.execute('SELECT order_number, delivery_method FROM orders WHERE id = ?', [orderId]));
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }


    return {data: { msg: 'Order status updated', orderId: orderId, orderNumber: order.order_number, deliveryMethod: order.delivery_method, orderStatus: orderStatus }};
  }

  static async sendNotificationToLocation(locationId, orderId, orderNumber) {
    // Send notification about order
    const expo = new Expo();

    // getting push tokens of logged users who enabled notifications for this location
    const connection = await pool.getConnection();
    let usersData;
    let dataForNavigation;
    try {
      const [users] = await connection.execute('SELECT user_id FROM location_notifications WHERE location_id = ?', [locationId]);
      if (users.length === 0) return;
      let questionsString = '';
      const values = [];
      users.forEach((user, index) => {
        values.push(user.user_id);
        if (index === 0) {
          questionsString += '(?';
        } else {
          questionsString += ', ?'
        }
        if (index === users.length - 1) questionsString += ')'
      });
      [usersData] = await pool.execute(`SELECT user_id, push_token, language FROM business_user_tokens WHERE user_id IN ${questionsString}`, values);

      // getting all required information for notification body
      const [[locationData]] = await connection.execute('SELECT id, shop_id, city, address FROM locations WHERE id = ?', [locationId]);
      const [[shopData]] = await connection.execute('SELECT id, title, image_url, currency FROM shops WHERE id = ?', [locationData.shop_id]);
      dataForNavigation = shopData;
      dataForNavigation.location_id = locationData.id;
      dataForNavigation.city = locationData.city;
      dataForNavigation.address = locationData.address;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    // sending notifications for all push tokens

    // Create the messages that you want to send to clients
    let messages = [];
    for (let userData of usersData) {
      // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

      // Check that all your push tokens appear to be valid Expo push tokens
      if (!Expo.isExpoPushToken(userData.push_token)) {
        console.error(`Push token ${userData.push_token} is not a valid Expo push token`);
      } else {
        const text = getLocalizedText(userData.language);
        // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
        messages.push({
          to: userData.push_token,
          sound: 'default',
          title: `${dataForNavigation.address}, ${dataForNavigation.city}`,
          body: `${text.newOrder}: ${orderNumber}`,
          data: { newOrderReceived: true, orderId: orderId, orderNumber: orderNumber, dataForNavigation: dataForNavigation },
        })
      }
    }

    // The Expo push notification service accepts batches of notifications so
    // that you don't need to send 1000 requests to send 1000 notifications. We
    // recommend you batch your notifications to reduce the number of requests
    // and to compress them (notifications with similar content will get
    // compressed).
    let chunks = expo.chunkPushNotifications(messages);
    // console.log(chunks);
    let tickets = [];
    (async () => {
      // Send the chunks to the Expo push notification service. There are
      // different strategies you could use. A simple one is to send one chunk at a
      // time, which nicely spreads the load out over time:
      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          // console.log(ticketChunk);
          tickets.push(...ticketChunk);
          // NOTE: If a ticket contains an error code in ticket.details.error, you
          // must handle it appropriately. The error codes are listed in the Expo
          // documentation:
          // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
        } catch (error) {
          console.error(error);
        }
      }
    })();

    setTimeout(() => {
      // Later, after the Expo push notification service has delivered the
      // notifications to Apple or Google (usually quickly, but allow the the service
      // up to 30 minutes when under load), a "receipt" for each notification is
      // created. The receipts will be available for at least a day; stale receipts
      // are deleted.
      //
      // The ID of each receipt is sent back in the response "ticket" for each
      // notification. In summary, sending a notification produces a ticket, which
      // contains a receipt ID you later use to get the receipt.
      //
      // The receipts may contain error codes to which you must respond. In
      // particular, Apple or Google may block apps that continue to send
      // notifications to devices that have blocked notifications or have uninstalled
      // your app. Expo does not control this policy and sends back the feedback from
      // Apple and Google so you can handle it appropriately.
      let receiptIds = [];
      for (let ticket of tickets) {
        // NOTE: Not all tickets have IDs; for example, tickets for notifications
        // that could not be enqueued will have error information and no receipt ID.
        if (ticket.id) {
          receiptIds.push(ticket.id);
        }
      }

      let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      (async () => {
        // Like sending notifications, there are different strategies you could use
        // to retrieve batches of receipts from the Expo service.
        for (let chunk of receiptIdChunks) {
          try {
            let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
            // console.log(receipts);

            // The receipts specify whether Apple or Google successfully received the
            // notification and information about an error, if one occurred.
            for (let receiptId in receipts) {
              let { status, message, details } = receipts[receiptId];
              if (status === 'ok') {
                continue;
              } else if (status === 'error') {
                console.error(
                  `There was an error sending a notification: ${message}`
                );
                if (details && details.error) {
                  // The error codes are listed in the Expo documentation:
                  // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
                  // You must handle the errors appropriately.
                  console.error(`The error code is ${details.error}`);
                }
              }
            }
          } catch (error) {
            console.error(error);
          }
        }
      })();
    }, 5000);
    // --------------------------------------------
  }

  static async sendNotificationToUser(orderId, orderNumber, deliveryMethod, orderStatus) {
    if (orderStatus !== 'ready') return;

    // Send notification about order
    const expo = new Expo();

    // get push token of users who make order
    const [[user]] = await pool.execute('SELECT order_number, push_token, language FROM orders WHERE id = ?', [orderId]);
    if (!user) return;

    // getting localized text
    const text = getLocalizedText(user.language);

    // sending notifications for all push tokens
    const pushTokens = [user.push_token];
    // Create the messages that you want to send to clients
    let messages = [];
    for (let pushToken of pushTokens) {
      // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

      // Check that all your push tokens appear to be valid Expo push tokens
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
      } else {
        // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
        messages.push({
          to: pushToken,
          sound: 'default',
          title: text.orderReady,
          body: `${text.orderNumber}: ${user.order_number}`,
          data: { orderStatusUpdate: true, orderId: orderId, orderNumber: orderNumber, deliveryMethod: deliveryMethod, orderStatus: orderStatus },
        })
      }
    }

    // The Expo push notification service accepts batches of notifications so
    // that you don't need to send 1000 requests to send 1000 notifications. We
    // recommend you batch your notifications to reduce the number of requests
    // and to compress them (notifications with similar content will get
    // compressed).
    let chunks = expo.chunkPushNotifications(messages);
    // console.log(chunks);
    let tickets = [];
    (async () => {
      // Send the chunks to the Expo push notification service. There are
      // different strategies you could use. A simple one is to send one chunk at a
      // time, which nicely spreads the load out over time:
      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          // console.log(ticketChunk);
          tickets.push(...ticketChunk);
          // NOTE: If a ticket contains an error code in ticket.details.error, you
          // must handle it appropriately. The error codes are listed in the Expo
          // documentation:
          // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
        } catch (error) {
          console.error(error);
        }
      }
    })();

    setTimeout(() => {
      // Later, after the Expo push notification service has delivered the
      // notifications to Apple or Google (usually quickly, but allow the the service
      // up to 30 minutes when under load), a "receipt" for each notification is
      // created. The receipts will be available for at least a day; stale receipts
      // are deleted.
      //
      // The ID of each receipt is sent back in the response "ticket" for each
      // notification. In summary, sending a notification produces a ticket, which
      // contains a receipt ID you later use to get the receipt.
      //
      // The receipts may contain error codes to which you must respond. In
      // particular, Apple or Google may block apps that continue to send
      // notifications to devices that have blocked notifications or have uninstalled
      // your app. Expo does not control this policy and sends back the feedback from
      // Apple and Google so you can handle it appropriately.
      let receiptIds = [];
      for (let ticket of tickets) {
        // NOTE: Not all tickets have IDs; for example, tickets for notifications
        // that could not be enqueued will have error information and no receipt ID.
        if (ticket.id) {
          receiptIds.push(ticket.id);
        }
      }

      let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      (async () => {
        // Like sending notifications, there are different strategies you could use
        // to retrieve batches of receipts from the Expo service.
        for (let chunk of receiptIdChunks) {
          try {
            let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
            // console.log(receipts);

            // The receipts specify whether Apple or Google successfully received the
            // notification and information about an error, if one occurred.
            for (let receiptId in receipts) {
              let { status, message, details } = receipts[receiptId];
              if (status === 'ok') {
                continue;
              } else if (status === 'error') {
                console.error(
                  `There was an error sending a notification: ${message}`
                );
                if (details && details.error) {
                  // The error codes are listed in the Expo documentation:
                  // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
                  // You must handle the errors appropriately.
                  console.error(`The error code is ${details.error}`);
                }
              }
            }
          } catch (error) {
            console.error(error);
          }
        }
      })();
    }, 5000);
    // --------------------------------------------
  }

  static async postSendOrderTimeAsync(accessToken, orderId, hours, minutes) {
    // check request body validity
    if (typeof accessToken !== 'string' || typeof orderId !== 'number' || typeof hours !== 'string'  || typeof minutes !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    hours = hours.trim();
    minutes = minutes.trim();

    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const errors = [];
    // check time validity
    const hourInt = parseInt(hours);
    const minuteInt = parseInt(minutes);
    if (hours.length === 0 && minutes.length === 0) {
      errors.push({ param: 'time', msg: 'Empty value' });
    } else if (hours.length === 0 || minutes.length === 0) {
      errors.push({ param: 'time', msg: 'Invalid value' });
    } else if (hourInt === 0 && minuteInt === 0) {
      errors.push({ param: 'time', msg: 'Invalid value' });
    } else if (minutes.length > 2) {
      errors.push({ param: 'time', msg: 'Invalid value' });
    } else if (hourInt < 0 || isNaN(hourInt) ||
      minuteInt < 0 || minuteInt > 59 || isNaN(minuteInt)
    ) {
      errors.push({ param: 'time', msg: 'Invalid value' });
    }

    if (errors.length > 0) {
      return { errors: errors };
    }

    const connection = await pool.getConnection();
    try {
      // check if user is changing order status in shop to wich it belongs
      const [users] = await connection.execute('SELECT shop_id FROM business_users WHERE id = ?', [user.id]);
      if (users.length === 0) return { errors: [{ msg: 'Unauthorized' }] };
      const [orders] = await connection.execute('SELECT location_id FROM orders WHERE id = ?', [orderId]);
      if (orders.length === 0) return { errors: [{ msg: 'Order do not exist', orderId: orderId }] };
      const [locations] = await connection.execute('SELECT shop_id FROM locations WHERE id = ?', [orders[0].location_id]);
      if (users[0].shop_id !== locations[0].shop_id) return { errors: [{ msg: 'Order do not exist', orderId: orderId }] };

      // updating order time_sended in database
      const [result] = (await connection.execute('UPDATE orders SET time_sended = ? WHERE id = ?', [1, orderId]));
      if (result.affectedRows === 0) return { errors: [{ msg: 'Order do not exist', orderId: orderId }] };
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return {data: { msg: 'Sending notification to user', orderId: orderId, hours: hours, minutes: minutes }};
  }

  static async sendNotificationToUserAboutOrderReadinessTime(orderId, hours, minutes) {
    // Send notification about order
    const expo = new Expo();

    // get push token of users who make order
    const [[user]] = await pool.execute('SELECT order_number, status, delivery_method, push_token, language FROM orders WHERE id = ?', [orderId]);
    if (!user) return;

    // getting localized text
    const text = getLocalizedText(user.language);

    // sending notifications for all push tokens
    const pushTokens = [user.push_token];
    // Create the messages that you want to send to clients
    let messages = [];
    for (let pushToken of pushTokens) {
      // Each push token looks like ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

      // Check that all your push tokens appear to be valid Expo push tokens
      if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
      } else {
        // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
        const hoursParsed = parseInt(hours);
        const minutesParsed = parseInt(minutes);
        let bodyMessage = text.orderWillBeReady;
        if (hoursParsed > 0) {
          hoursParsed > 1 ? bodyMessage = `${bodyMessage} ${hoursParsed} ${text.hours}` : bodyMessage = `${bodyMessage} ${hoursParsed} ${text.hour}`;
        }
        if (minutesParsed > 0) {
          hoursParsed > 0
            ? minutesParsed > 1 ? bodyMessage = `${bodyMessage} ${text.and} ${minutesParsed} ${text.minutes}` : bodyMessage = `${bodyMessage} ${text.and} ${minutesParsed} ${text.minute}`
            : minutesParsed > 1 ? bodyMessage = `${bodyMessage} ${minutesParsed} ${text.minutes}` : bodyMessage = `${bodyMessage} ${minutesParsed} ${text.minute}`;
        }
        messages.push({
          to: pushToken,
          sound: 'default',
          title: `${text.order} ${user.order_number}`,
          body: bodyMessage,
          data: { orderReadindessTimeUpdate: true, orderId: orderId, orderNumber: user.order_number, deliveryMethod: user.delivery_method, orderStatus: user.status },
        })
      }
    }

    // The Expo push notification service accepts batches of notifications so
    // that you don't need to send 1000 requests to send 1000 notifications. We
    // recommend you batch your notifications to reduce the number of requests
    // and to compress them (notifications with similar content will get
    // compressed).
    let chunks = expo.chunkPushNotifications(messages);
    // console.log(chunks);
    let tickets = [];
    (async () => {
      // Send the chunks to the Expo push notification service. There are
      // different strategies you could use. A simple one is to send one chunk at a
      // time, which nicely spreads the load out over time:
      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          // console.log(ticketChunk);
          tickets.push(...ticketChunk);
          // NOTE: If a ticket contains an error code in ticket.details.error, you
          // must handle it appropriately. The error codes are listed in the Expo
          // documentation:
          // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
        } catch (error) {
          console.error(error);
        }
      }
    })();

    setTimeout(() => {
      // Later, after the Expo push notification service has delivered the
      // notifications to Apple or Google (usually quickly, but allow the the service
      // up to 30 minutes when under load), a "receipt" for each notification is
      // created. The receipts will be available for at least a day; stale receipts
      // are deleted.
      //
      // The ID of each receipt is sent back in the response "ticket" for each
      // notification. In summary, sending a notification produces a ticket, which
      // contains a receipt ID you later use to get the receipt.
      //
      // The receipts may contain error codes to which you must respond. In
      // particular, Apple or Google may block apps that continue to send
      // notifications to devices that have blocked notifications or have uninstalled
      // your app. Expo does not control this policy and sends back the feedback from
      // Apple and Google so you can handle it appropriately.
      let receiptIds = [];
      for (let ticket of tickets) {
        // NOTE: Not all tickets have IDs; for example, tickets for notifications
        // that could not be enqueued will have error information and no receipt ID.
        if (ticket.id) {
          receiptIds.push(ticket.id);
        }
      }

      let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
      (async () => {
        // Like sending notifications, there are different strategies you could use
        // to retrieve batches of receipts from the Expo service.
        for (let chunk of receiptIdChunks) {
          try {
            let receipts = await expo.getPushNotificationReceiptsAsync(chunk);
            // console.log(receipts);

            // The receipts specify whether Apple or Google successfully received the
            // notification and information about an error, if one occurred.
            for (let receiptId in receipts) {
              let { status, message, details } = receipts[receiptId];
              if (status === 'ok') {
                continue;
              } else if (status === 'error') {
                console.error(
                  `There was an error sending a notification: ${message}`
                );
                if (details && details.error) {
                  // The error codes are listed in the Expo documentation:
                  // https://docs.expo.io/push-notifications/sending-notifications/#individual-errors
                  // You must handle the errors appropriately.
                  console.error(`The error code is ${details.error}`);
                }
              }
            }
          } catch (error) {
            console.error(error);
          }
        }
      })();
    }, 5000);
    // --------------------------------------------
  }
}