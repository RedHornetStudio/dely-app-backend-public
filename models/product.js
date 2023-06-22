const bigDecimal = require('js-big-decimal');

const pool = require('../util/database');
const { jwtVerifyAsync } = require('../util/functions');
const { productImageUploadToGcStorageAsync, productImageDeletionFromGcStorageAsync } = require('../util/gcStorage');

module.exports = class Product {
  constructor(category, title, price, description, optionsString, file, accessToken) {
    this.category = typeof category === 'string' ? category.trim() : category;
    this.title = typeof title === 'string' ? title.trim() : title;
    this.price = typeof price === 'string' ? price.trim() : price;
    this.description = typeof description === 'string' ? description.trim() : description;
    this.optionsString = typeof optionsString === 'string' ? optionsString.trim() : optionsString;
    this.file = file;
    this.accessToken = accessToken
  }

  async postAddProductAsync() {
    // check request body validity
    if (typeof this.category !== 'string' || typeof this.title !== 'string' || typeof this.price !== 'string' || typeof this.description !== 'string' || typeof this.optionsString !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    let category= this.category;
    let title = this.title;
    let price = this.price;
    let description = this.description;
    let optionsString = this.optionsString;
    let file = this.file;
    let accessToken = this.accessToken;
  
    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }
  
    const connection = await pool.getConnection();
    let productId;
    try {
      // getting user data
      const users = (await connection.execute('SELECT shop_id, email, role FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }
  
      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };
  
      const errors = [];
      // check category input field
      if (category.length === 0) {
        errors.push({ value: category, param: 'category', msg: 'Empty value' });
      }

      // check title input field
      if (title.length === 0) {
        errors.push({ value: title, param: 'title', msg: 'Empty value' });
      }

      // check price input field
      if (price.length === 0) {
        errors.push({ value: price, param: 'price', msg: 'Empty value' });
      } else if (!/^[0-9]+(\.[0-9]+)?$/.test(price)) {
        errors.push({ value: price, param: 'price', msg: 'Invalid value' });
      }

      // check optionsString
      let options;
      try {
        options = JSON.parse(optionsString);
      } catch (error) {
        errors.push({ value: optionsString, param: 'options', msg: 'Invalid value' });
      }

      if (errors.length > 0) {
        return { errors: errors };
      }

      // inserting product in products table, inserting options in options table and inserting option variants in option_variants table
      try {
        await connection.query('START TRANSACTION');

        const product = (await connection.execute('INSERT INTO products (shop_id, category, title, price, description) VALUES (?, ?, ?, ?, ?)', [users[0].shop_id, category, title, new bigDecimal(price).round(2).getValue(), description]))[0];
        productId = product.insertId;

        for (let i = 0; i < options.length; i++) {
          const option = (await connection.execute('INSERT INTO product_options (product_id, title, required, multiple) VALUES (?, ?, ?, ?)', [productId, options[i].title, options[i].required, options[i].multiple]))[0];
          let optionId = option.insertId;
          for (let j = 0; j < options[i].options.length; j++) {
            const optionVariant = (await connection.execute('INSERT INTO option_variants (option_id, title, price) VALUES (?, ?, ?)', [optionId, options[i].options[j].title, new bigDecimal(options[i].options[j].price).round(2).getValue()]))[0]
          }
        }

        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      }
  
      // saving image to Google Cloud Storage
      let imageUrl;
      if (file) {
        try {
          imageUrl = await productImageUploadToGcStorageAsync(file, users[0].shop_id, productId);
        } catch (error) {
          console.log(`Error while saving product image to Google Cloud Storage: ${error}`);
        }
      }

      // updating image_url in products table
      if (imageUrl) {
        const productImageUpdate = (await connection.execute('UPDATE products SET image_url = ? WHERE id = ?', [imageUrl, productId]))[0];
      }
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  
    return {data: { msg: 'Product added successfully' }};
  }

  static async postEditProductAsync(optionsEdited, id, category, title, price, description, optionsString, file, accessToken) {
    // check request body validity
    if (typeof optionsEdited !== 'string' || typeof id !== 'string' || typeof category !== 'string' || typeof title !== 'string' || typeof price !== 'string' || typeof description !== 'string' || typeof optionsString !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    id = Number(id).toString();
    category= category.trim();
    title = title.trim();
    price = price.trim();
    description = description.trim();
    optionsString = optionsString.trim();
  
    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }
  
    const connection = await pool.getConnection();
    const productId = id;
    try {
      // getting user data
      const users = (await connection.execute('SELECT shop_id, email, role FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }
  
      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };
  
      const errors = [];
      // check category input field
      if (category.length === 0) {
        errors.push({ value: category, param: 'category', msg: 'Empty value' });
      }

      // check title input field
      if (title.length === 0) {
        errors.push({ value: title, param: 'title', msg: 'Empty value' });
      }

      // check price input field
      if (price.length === 0) {
        errors.push({ value: price, param: 'price', msg: 'Empty value' });
      } else if (!/^[0-9]+(\.[0-9]+)?$/.test(price)) {
        errors.push({ value: price, param: 'price', msg: 'Invalid value' });
      }

      // check optionsString
      let options;
      try {
        options = JSON.parse(optionsString);
      } catch (error) {
        errors.push({ value: optionsString, param: 'options', msg: 'Invalid value' });
      }

      if (errors.length > 0) {
        return { errors: errors };
      }

      // updating product in products table, updating options in options table and updating option variants in option_variants table
      try {
        await connection.query('START TRANSACTION');

        const product = (await connection.execute('UPDATE products SET category = ?, title = ?, price = ?, description = ? WHERE id = ? AND shop_id = ?', [category, title, new bigDecimal(price).round(2).getValue(), description, productId, users[0].shop_id]))[0];
        if (product.affectedRows === 0) {
          await connection.query("ROLLBACK");
          return { errors: [{ msg: 'Product do not exist', productId: productId }] };
        }
        if (optionsEdited === 'true') {
          await connection.execute('DELETE FROM product_options WHERE product_id = ?', [productId]);
          for (let i = 0; i < options.length; i++) {
            const option = (await connection.execute('INSERT INTO product_options (product_id, title, required, multiple) VALUES (?, ?, ?, ?)', [productId, options[i].title, options[i].required, options[i].multiple]))[0];
            let optionId = option.insertId;
            for (let j = 0; j < options[i].options.length; j++) {
              const optionVariant = (await connection.execute('INSERT INTO option_variants (option_id, title, price) VALUES (?, ?, ?)', [optionId, options[i].options[j].title, new bigDecimal(options[i].options[j].price).round(2).getValue()]))[0]
            }
          }
        }

        await connection.query("COMMIT");
      } catch (error) {
        await connection.query("ROLLBACK");
        throw error;
      }
  
      // saving image to Google Cloud Storage
      let imageUrl;
      if (file) {
        try {
          imageUrl = await productImageUploadToGcStorageAsync(file, users[0].shop_id, productId);
        } catch (error) {
          console.log(`Error while saving product image to Google Cloud Storage: ${error}`);
        }
      }

      // updating image_url in products table
      if (imageUrl) {
        const productImageUpdate = (await connection.execute('UPDATE products SET image_url = ? WHERE id = ?', [imageUrl, productId]))[0];
      }
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  
    return {data: { msg: 'Product edited successfully' }};
  };

  static async postDeleteProductAsync(productId, accessToken) {
    // check request body validity
    if (typeof productId !== 'number') {
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
    try {
      await connection.query('START TRANSACTION');
      // getting user data
      const users = (await connection.execute('SELECT shop_id, role FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      // deleting product from database
      const product = (await connection.execute('DELETE FROM products WHERE id = ? AND shop_id = ?', [productId, users[0].shop_id]))[0];

      // deleting product from Google Cloud Storage
      await productImageDeletionFromGcStorageAsync(users[0].shop_id, productId);

      await connection.query("COMMIT");
      if (product.affectedRows === 0) return { errors: [{ msg: 'Product do not exist', productId: productId }] };
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }

    return {data: { msg: 'Product deleted successfully' }};
  }

  static async getProductsAsync(shopId) {
    if (typeof shopId !== 'number') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // request from database products where shopId === shopId with fields id, category, title, price, imageUrl, currency
    const products = (await pool.execute('SELECT id, category, title, price, image_url FROM products WHERE shop_id = ?', [shopId]))[0];
    return { data: products };
  }

  static async getProductDetailsAsync(productId) {
    if (typeof productId !== 'number') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // request from database product where id === productId with fields description, options
    const connection = await pool.getConnection();
    let productDetails = {};
    try {
      const productDetailsArray = (await connection.execute('SELECT description FROM products WHERE id = ?', [productId]))[0];
      if (productDetailsArray.length === 0) return { errors: [{ msg: 'Product do not exist or where been deleted' }] };
      productDetails = productDetailsArray[0];
      const options = (await connection.execute('SELECT id, title, required, multiple FROM product_options WHERE product_id = ?', [productId]))[0];
      productDetails.options = options;
      for(let i = 0; i < options.length; i++) {
        const variants = (await connection.execute('SELECT title, price FROM option_variants WHERE option_id = ?', [options[i].id]))[0];
        productDetails.options[i].variants = variants
      }
    } catch (error) {
      throw new Error(error.message);
    } finally {
      connection.release();
    }

    return { data: productDetails };
  }
}