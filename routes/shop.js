const express = require('express');

const productsController = require('../controllers/products');
const shopsController = require('../controllers/shops');
const locationsController = require('../controllers/locations');
const ordersController = require('../controllers/orders');

const router = express.Router();

router.post('/getShops', shopsController.getShops);
router.post('/getFavoriteShops', shopsController.getFavoriteShops);
router.post('/getLocations', locationsController.getLocations);
router.post('/getProducts', productsController.getProducts);
router.post('/getProductDetails', productsController.getProductDetails);
router.post('/postOrder', ordersController.postOrder);
router.post('/getOrderUpdate', ordersController.getOrderUpdate);
router.post('/getOrderDetails', ordersController.getOrderDetails);
router.post('/getOrderHistory', ordersController.getOrderHistory);

module.exports = router;