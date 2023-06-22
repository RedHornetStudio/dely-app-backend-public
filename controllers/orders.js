const Order = require('../models/order');

exports.postOrder = (req, res, next) => {
  (async () => {
    try {
      const order = new Order(req.body.order.locationId, req.body.order.currency, req.body.order.deliveryMethodDetails, req.body.order.deliveryPrice, req.body.order.shoppingCartItems, req.body.order.pushToken, req.body.order.language);
      const response = await order.postOrderAsync();
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        Order.sendNotificationToLocation(req.body.order.locationId, response.data.orderId, response.data.orderNumber);
        res.json({ status: 'SUCCESS', data: { orderId: response.data.orderId, orderNumber: response.data.orderNumber } });
      }
    } catch (error) {
      next(error)
    }
  })();
};

exports.getOrderUpdate = (req, res, next) => {
  (async () => {
    try {
      const response = await Order.getOrderUpdateAsync(req.body.orderId, req.body.orderNumber);
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        res.json({ status: 'SUCCESS', data: response.data });
      }
    } catch (error) {
      next(error)
    }
  })();
};

exports.getOrderDetails = (req, res, next) => {
  (async () => {
    try {
      const response = await Order.getOrderDetailsAsync(req.body.orderId, req.body.orderNumber);
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        res.json({ status: 'SUCCESS', data: response.data });
      }
    } catch (error) {
      next(error)
    }
  })();
};

exports.getOrderHistory = (req, res, next) => {
  (async () => {
    try {
      const response = await Order.getOrderHistoryAsync(req.body.orderHistory);
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        res.json({ status: 'SUCCESS', data: response.data });
      }
    } catch (error) {
      next(error)
    }
  })();
};

exports.getOrders = (req, res, next) => {
  (async () => {
    try {
      const response = await Order.getOrdersAsync(req.body.accessToken, req.body.locationId, req.body.filters, req.body.lastOrderGenerationTime);
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        res.json({ status: 'SUCCESS', data: response.data });
      }
    } catch (error) {
      next(error);
    }
  })();
};

exports.postChangeOrderStatus = (req, res, next) => {
  (async () => {
    try {
      const response = await Order.postChangeOrderStatusAsync(req.body.accessToken, req.body.orderId, req.body.orderStatus);
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        Order.sendNotificationToUser(response.data.orderId, response.data.orderNumber, response.data.deliveryMethod, response.data.orderStatus);
        res.json({ status: 'SUCCESS', data: { orderId: response.data.orderId, orderStatus: response.data.orderStatus } });
      }
    } catch (error) {
      next(error);
    }
  })();
}

exports.postSendOrderTime = (req, res, next) => {
  (async () => {
    try {
      const response = await Order.postSendOrderTimeAsync(req.body.accessToken, req.body.orderId, req.body.hours, req.body.minutes);
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        Order.sendNotificationToUserAboutOrderReadinessTime(response.data.orderId, response.data.hours, response.data.minutes);
        res.json({ status: 'SUCCESS', data: response.data });
      }
    } catch (error) {
      next(error);
    }
  })();
}