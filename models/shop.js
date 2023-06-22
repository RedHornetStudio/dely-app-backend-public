const pool = require('../util/database');
const { jwtVerifyAsync } = require('../util/functions');
const { shopImageUploadToGcStorageAsync } = require('../util/gcStorage');

module.exports = class Shop {
  static async postEditShopAsync(accessToken, country, currency, businessName, description) {

    // check request body validity
    if (typeof country !== 'string' || typeof currency !== 'string' || typeof businessName !== 'string' || typeof description !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }
    
    country = country.trim();
    currency = currency.trim()
    businessName = businessName.trim();
    description = description.trim();

    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const connection = await pool.getConnection();
    try {
      // getting user data
      const users = (await connection.execute('SELECT shop_id, email, role FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      const errors = [];
      // check country input field
      if (country.length === 0) {
        errors.push({ value: country, param: 'country', msg: 'Empty value' });
      } else if (!/^[a-zA-z]+$/.test(country)) {
        errors.push({ value: country, param: 'country', msg: 'Invalid value' });
      }

      // check currency input field
      if (currency.length === 0) {
        errors.push({ value: this.currency, param: 'currency', msg: 'Empty value' });
      }
      
      // check businessName input field
      if (businessName.length === 0) {
        errors.push({ value: businessName, param: 'businessName', msg: 'Empty value' });
      }
      // else if (!/^[a-zA-z0-9!"#$%&'()*+,\-.?/:;@{}[\]~_^`|\ ]+$/.test(businessName)) {
      //   errors.push({ value: businessName, param: 'businessName', msg: 'Invalid value' });
      // }

      if (errors.length > 0) {
        return { errors: errors };
      }

      // getting shop data
      const shop = (await connection.execute('UPDATE shops SET country = ?, currency = ?, title = ?, description = ? WHERE id = ?', [country, currency, businessName, description, users[0].shop_id]))[0];
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return {data: { msg: 'Shop data updated successfully' }}; 
  }

  static async postShopImageAsync(file, accessToken) {

    // verify accessToken validity
    let user;
    let imageUrl;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const connection = await pool.getConnection();
    try {
      // getting user data
      const users = (await connection.execute('SELECT shop_id, role FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) return { errors: [{ msg: 'Unauthorized' }] };

      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      // saving image to Google Cloud Storage
      imageUrl = await shopImageUploadToGcStorageAsync(file, users[0].shop_id);
      
      // saving image url to database
      const shop = (await connection.execute('UPDATE shops SET image_url = ? WHERE id = ?', [imageUrl, users[0].shop_id]))[0];
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: { msg: 'Upload successful', imageUrl: imageUrl }};
  }

  static async getShopsAsync(country) {
    if (typeof country !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    const shops = (await pool.execute('SELECT id, title, description, image_url, currency FROM shops WHERE country = ?', [country]))[0];
    return { data: shops };
  }

  static async getFavoriteShopsAsync(country, favoriteShopIds) {
    if (typeof country !== 'string' || !Array.isArray(favoriteShopIds)) {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    if (favoriteShopIds.length === 0) return { data: [] };
    let questionsString = '';
    const values = [country];
    favoriteShopIds.forEach((id, index) => {
      values.push(id);
      if (index === 0) {
        questionsString += '(?';
      } else {
        questionsString += ', ?'
      }
      if (index === favoriteShopIds.length - 1) questionsString += ')'
    });
    const favoriteShops = (await pool.execute(`SELECT id, title, description, image_url, currency FROM shops WHERE country = ? AND id IN ${questionsString}`, values))[0];
    return { data: favoriteShops };
  }

  static async getAdminShopAsync(accessToken) {
    
    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const connection = await pool.getConnection();
    let shopData;
    try {
      // getting user data
      const users = (await connection.execute('SELECT shop_id, email, role FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // getting shop data
      const shops = (await connection.execute('SELECT title, description, country, image_url, currency FROM shops WHERE id = ?', [users[0].shop_id]))[0];
      shopData = {...shops[0]};
      shopData.shopId = users[0].shop_id;
      shopData.email = users[0].email;
      shopData.role = users[0].role;
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: shopData }; 
  }
}