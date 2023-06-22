const Shop = require('../models/shop');

exports.postEditShop = (req, res, next) => {
  (async () => {
    try {
      const response = await Shop.postEditShopAsync(req.body.accessToken, req.body.country, req.body.currency, req.body.businessName, req.body.description);
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

exports.postShopImage = (req, res, next) => {
  (async () => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      const response = await Shop.postShopImageAsync(req.file, accessToken);
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

exports.getShops = (req, res, next) => {
  (async () => {
    try {
      const response = await Shop.getShopsAsync(req.body.country);
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

exports.getFavoriteShops = (req, res, next) => {
  (async () => {
    try {
      const response = await Shop.getFavoriteShopsAsync(req.body.country, req.body.favoriteShops);
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

exports.getAdminShop = (req, res, next) => {
  (async () => {
    try {
      const response = await Shop.getAdminShopAsync(req.body.accessToken);
      if (response.errors) {
        res.json({ status: 'FAILED', errors: response.errors });
      } else {
        res.json({ status: 'SUCCESS', data: response.data });
      };
    } catch (error) {
      next(error);
    }
  })();
};