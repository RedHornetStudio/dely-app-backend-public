const Location = require('../models/location');

exports.postAddLocation = (req, res, next) => {
  (async () => {
    try {
      const location = new Location(req.body.accessToken, req.body.city, req.body.address, req.body.phoneNumber, req.body.delivery, req.body.inPlace, req.body.takeAway, req.body.workingHours, req.body.deliveryPrice, req.body.timeZone);
      const response = await location.postAddLocationAsync();
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

exports.postEditLocation = (req, res, next) => {
  (async () => {
    try {
      const response = await Location.postEditLocationAsync(req.body.accessToken, req.body.id, req.body.city, req.body.address, req.body.phoneNumber, req.body.delivery, req.body.inPlace, req.body.takeAway, req.body.workingHours, req.body.deliveryPrice, req.body.timeZone);
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

exports.postDeleteLocation = (req, res, next) => {
  (async () => {
    try {
      const response = await Location.postDeleteLocationAsync(req.body.locationId, req.body.accessToken);
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

exports.getLocations = (req, res, next) => {
  (async () => {
    try {
      const response = await Location.getLocationsAsync(req.body.shopId);
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

exports.getLocationsWithNotifications = (req, res, next) => {
  (async () => {
    try {
      const response = await Location.getLocationsWithNotificationsAsync(req.body.accessToken);
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

exports.postNotifications = (req, res, next) => {
  (async () => {
    try {
      const response = await Location.postNotificationsAsync(req.body.accessToken, req.body.notifications);
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