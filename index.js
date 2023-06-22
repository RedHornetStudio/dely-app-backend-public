require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const errorsController = require('./controllers/errors');

const app = express();

const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

// ### for testing test page
const path = require('path');
app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'Views', 'main.html'));
});
// ################33#####

app.use(shopRoutes);
app.use(authRoutes);
app.use(adminRoutes);
app.use(errorsController.multerErrorHandler);

// errors
app.use('/', errorsController.badRoute);
app.use(errorsController.errorHandler);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});