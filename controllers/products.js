const Product = require('../models/product');

exports.postAddProduct = (req, res, next) => {
  (async () => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      const product = new Product(req.body.category, req.body.title, req.body.price, req.body.description, req.body.options, req.file, accessToken);
      const response = await product.postAddProductAsync();
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

exports.postEditProduct = (req, res, next) => {
  (async () => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      const response = await Product.postEditProductAsync(req.body.optionsEdited, req.body.id, req.body.category, req.body.title, req.body.price, req.body.description, req.body.options, req.file, accessToken);
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

exports.postDeleteProduct = (req, res, next) => {
  (async () => {
    try {
      const response = await Product.postDeleteProductAsync(req.body.productId, req.body.accessToken);
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

exports.getProducts = (req, res, next) => {
  (async () => {
    try {
      const response = await Product.getProductsAsync(req.body.shopId);
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

exports.getProductDetails = (req, res, next) => {
  (async () => {
    try {
      const response = await Product.getProductDetailsAsync(req.body.productId);
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