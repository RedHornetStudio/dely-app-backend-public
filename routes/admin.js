const express = require('express');

const shopController = require('../controllers/shops');
const productsController = require('../controllers/products');
const locationsController = require('../controllers/locations');
const ordersController = require('../controllers/orders');
const { saveImageToMemory } = require('../util/multer');

const router = express.Router();

router.post('/admin/getAdminShop', shopController.getAdminShop);
router.post('/admin/postEditShop', shopController.postEditShop);
router.post('/admin/postShopImage', saveImageToMemory.single('image'), shopController.postShopImage);
router.post('/admin/postAddProduct', saveImageToMemory.single('image'), productsController.postAddProduct);
router.post('/admin/postEditProduct', saveImageToMemory.single('image'), productsController.postEditProduct);
router.post('/admin/postDeleteProduct', productsController.postDeleteProduct);
router.post('/admin/postAddLocation', locationsController.postAddLocation);
router.post('/admin/postEditLocation', locationsController.postEditLocation);
router.post('/admin/postDeleteLocation', locationsController.postDeleteLocation);
router.post('/admin/getOrders', ordersController.getOrders);
router.post('/admin/postChangeOrderStatus', ordersController.postChangeOrderStatus);
router.post('/admin/postSendOrderTime', ordersController.postSendOrderTime);
router.post('/admin/getLocationsWithNotifications', locationsController.getLocationsWithNotifications);
router.post('/admin/postNotifications', locationsController.postNotifications);

module.exports = router;