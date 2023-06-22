const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const pool = require('../util/database');
const { jwtSignAsync, jwtVerifyAsync } = require('../util/functions');
const { allShopImagesDeletionFromGcStorageAsync } = require('../util/gcStorage');
const { getLocalizedText } = require('../util/getLocalizedText');

const ACCESS_TOKEN_VALIDITY_TIME = '10m';

module.exports = class Auth {
  constructor(country, currency, businessName, email, password, confirmPassword, pushToken, language) {
    this.country = typeof country === 'string' ? country.trim() : country;
    this.currency = typeof currency === 'string' ? currency.trim() : currency;
    this.businessName = typeof businessName === 'string' ? businessName.trim() : businessName;
    this.email = typeof email === 'string' ? email.trim() : email;
    this.password = password;
    this.confirmPassword = confirmPassword;
    this.pushToken = pushToken;
    this.language = language;
  }

  async businessSignUpAsync() {

    // check auth properties validity
    if (typeof this.country !== 'string' || typeof this.currency !== 'string' || typeof this.businessName !== 'string' || typeof this.email !== 'string' || typeof this.password !== 'string' || typeof this.confirmPassword !== 'string' || typeof this.pushToken !== 'string' || typeof this.language !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    const errors = [];
    // check country input field
    if (this.country.length === 0) {
      errors.push({ value: this.country, param: 'country', msg: 'Empty value' });
    } else if (!/^[a-zA-z]+$/.test(this.country)) {
      errors.push({ value: this.country, param: 'country', msg: 'Invalid value' });
    }

    // check currency input field
    if (this.currency.length === 0) {
      errors.push({ value: this.currency, param: 'currency', msg: 'Empty value' });
    }
    
    // check businessName input field
    if (this.businessName.length === 0) {
      errors.push({ value: this.businessName, param: 'businessName', msg: 'Empty value' });
    }
    // else if (!/^[a-zA-z0-9!"#$%&'()*+,\-.?/:;@{}[\]~_^`|\ ]+$/.test(this.businessName)) {
    //   errors.push({ value: this.businessName, param: 'businessName', msg: 'Invalid value' });
    // }

    // check email input field
    if (this.email.length === 0) {
      errors.push({ value: this.email, param: 'email', msg: 'Empty value' });
    } else if (!/^[a-zA-Z0-9]+([\.\-!#$%&'*+\/=?^_`{|}~]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([\.-]?[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,6})+$/.test(this.email)) {
      errors.push({ value: this.email, param: 'email', msg: 'Invalid value' });
    }

    // check password input field
    let errorInPassword = false;
    if (this.password.length === 0) {
      errors.push({ param: 'password', msg: 'Empty value' });
      errorInPassword = true;
    } else if (this.password.length < 6) {
      errors.push({ param: 'password',msg: 'Value is to short' });
      errorInPassword = true;
    }

    // check confirmPassword input field
    if (this.confirmPassword.length === 0) {
      errors.push({ param: 'confirmPassword', msg: 'Empty value' });
      errorInPassword = true;
    }

    // check if password and confirmPassword are equal
    if (!errorInPassword) {
      if (this.password !== this.confirmPassword) {
        errors.push({ param: 'password, confirmPassword', msg: 'Values are not equal' });
      }
    }

    if (errors.length > 0) {
      return { errors: errors };
    }

    let accessToken;
    let refreshToken;
    const connection = await pool.getConnection();
    try {
      // Validate if user does not already exist
      const [users] = await connection.execute('SELECT email FROM business_users WHERE email = ?', [this.email]);
      if (users.length > 0) {
        return { errors: [{ value: this.email, param: 'email', msg: 'Already exists' }]};
      }

      // Hash the password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(this.password, salt);

      // Save data in shops and business_users tables
      await connection.query('START TRANSACTION');
      const [shop] = await connection.execute('INSERT INTO shops (country, title, currency, description) VALUES (?, ?, ?, ?)', [this.country, this.businessName, this.currency, '']);
      const [user] = await connection.execute('INSERT INTO business_users (shop_id, email, password, role) VALUES (?, ?, ?, ?)', [shop.insertId, this.email, hashedPassword, 'admin']);

      // Generate access and refresh tokens and save them to database (save also pushToken)
      accessToken = await jwtSignAsync({ id: user.insertId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_VALIDITY_TIME });
      refreshToken = await jwtSignAsync({ id: user.insertId }, process.env.REFRESH_TOKEN_SECRET);
      await connection.execute('INSERT INTO business_user_tokens (user_id, refresh_token, push_token, language) VALUES (?, ?, ?, ?)', [user.insertId, refreshToken, this.pushToken, this.language]);
      
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }

    return { data: { accessToken, refreshToken } };
  }

  static async businessSignInAsync(email, password, pushToken, language) {

    // checking request body validity
    if (typeof email !== 'string' || typeof password !== 'string' || typeof pushToken !== 'string' || typeof language !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }
    
    email = email.trim();

    const errors = [];
    // check email input field
    if (email.length === 0) {
      errors.push({ value: this.email, param: 'email', msg: 'Empty value' });
    } else if (!/^[a-zA-Z0-9]+([\.\-!#$%&'*+\/=?^_`{|}~]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([\.-]?[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,6})+$/.test(email)) {
      errors.push({ value: email, param: 'email', msg: 'Invalid value' });
    }

    // check password input field
    if (password.length === 0) {
      errors.push({ param: 'password', msg: 'Empty value' });
    }

    if (errors.length > 0) {
      return { status: 'FAILED', errors: errors };
    }
    
    const connection = await pool.getConnection();

    let accessToken;
    let refreshToken;
    try {
      // check if user with email exists
      const users = (await connection.execute('SELECT id, password FROM business_users WHERE email = ?', [email]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Invalid credentials' }] };
      }
      
      // check if password is correct
      const equal = await bcrypt.compare(password, users[0].password);
      if (!equal) {
        return { errors: [{ msg: 'Invalid credentials' }] };
      }

      // Generate access and refresh tokens and save them to database (save also pushToken)
      accessToken = await jwtSignAsync({ id: users[0].id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_VALIDITY_TIME });
      refreshToken = await jwtSignAsync({ id: users[0].id }, process.env.REFRESH_TOKEN_SECRET);
      await connection.execute('INSERT INTO business_user_tokens (user_id, refresh_token, push_token, language) VALUES (?, ?, ?, ?)', [users[0].id, refreshToken, pushToken, language]);
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: { accessToken: accessToken, refreshToken: refreshToken }};
  }

  static async getBusinessAccessTokenAsync(refreshToken) {
    // verify refreshToken validity
    let user;
    try { 
      user = await jwtVerifyAsync(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const connection = await pool.getConnection();

    let userTokens
    try {
      // check if refresh token exists in data base
      userTokens = (await connection.execute('SELECT refresh_token, push_token FROM business_user_tokens WHERE user_id = ? AND refresh_token = ?', [user.id, refreshToken]))[0];
      if (userTokens.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // updating access_token_generation_time
      const timeStampUpdate = (await connection.execute('UPDATE business_user_tokens SET access_token_generation_time = CURRENT_TIMESTAMP WHERE user_id = ? AND refresh_token = ?', [user.id, refreshToken]))[0];
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    // generate new access token
    const accessToken = await jwtSignAsync({ id: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_VALIDITY_TIME });
    return { data: { accessToken: accessToken, pushTokenIsEmpty: userTokens[0].push_token.length === 0 }};
  }

  static async postPushTokenAsync(refreshToken, pushToken) {
    // check request body validity
    if (typeof refreshToken !== 'string' || typeof pushToken !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // verify refreshToken validity
    let user;
    try { 
      user = await jwtVerifyAsync(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const connection = await pool.getConnection();
    try {
      // verify if token exists
      const userTokens = (await connection.execute('SELECT refresh_token FROM business_user_tokens WHERE user_id = ? AND refresh_token = ?', [user.id, refreshToken]))[0];
      if (userTokens.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      const [result] = await pool.execute('UPDATE business_user_tokens SET push_token = ? WHERE refresh_token = ?', [pushToken, refreshToken]);
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: { msg: 'Push token updated successfully' } };
  }

  static async postBusinessSignOutAsync(refreshToken) {
    // verify refreshToken validity
    let user;
    try {
      user = await jwtVerifyAsync(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    // Delete token from database
    await pool.execute('DELETE FROM business_user_tokens WHERE user_id = ? AND refresh_token = ?', [user.id, refreshToken]);

    return { data: { msg: 'User logged out successfully' }};
  }

  static async postBusinessPasswordAsync(refreshToken, oldPassword, newPassword, newConfirmPassword) {
    // check request body validity
    if (typeof refreshToken !== 'string' || typeof oldPassword !== 'string' || typeof newPassword !== 'string' || typeof newConfirmPassword !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // verify refreshToken validity
    let user;
    try { 
      user = await jwtVerifyAsync(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const connection = await pool.getConnection();
    let newAccessToken;
    let newRefreshToken;
    try {
      // verify if token exists
      const userTokens = (await connection.execute('SELECT refresh_token FROM business_user_tokens WHERE user_id = ? AND refresh_token = ?', [user.id, refreshToken]))[0];
      if (userTokens.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // verify if user exists
      const users = (await connection.execute('SELECT password FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }
      
      const errors = [];
      // check if oldPassword is correct
      let errorInPassword = false;
      const equal = await bcrypt.compare(oldPassword, users[0].password);
      if (!equal) {
        errors.push({ param: 'oldPassword', msg: 'Invalid' });
      }

      // check newPassword input field
      if (newPassword.length === 0) {
        errors.push({ param: 'newPassword', msg: 'Empty value' });
        errorInPassword = true;
      } else if (newPassword.length < 6) {
        errors.push({ param: 'newPassword', msg: 'Value is to short' });
        errorInPassword = true;
      }

      // check newConfirmPassword input field
      if (newConfirmPassword.length === 0) {
        errors.push({ param: 'newConfirmPassword', msg: 'Empty value' });
        errorInPassword = true;
      }

      // check if newPassword and newConfirmPassword are equal
      if (!errorInPassword) {
        if (newPassword !== newConfirmPassword) {
          errors.push({ param: 'newPassword, newConfirmPassword', msg: 'Values are not equal' });
        }
      }

      if (errors.length > 0) {
        return { errors: errors };
      }

      // Hash the password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Generate access and refresh tokens and save them to database (save also pushToken)
      newAccessToken = await jwtSignAsync({ id: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10m' });
      newRefreshToken = await jwtSignAsync({ id: user.id }, process.env.REFRESH_TOKEN_SECRET);

      try {
        await connection.query('START TRANSACTION');
        await connection.execute('DELETE FROM business_user_tokens WHERE user_id = ? AND refresh_token != ?', [user.id, refreshToken]);
        await connection.execute('UPDATE business_user_tokens SET refresh_token = ? WHERE user_id = ? AND refresh_token = ?', [newRefreshToken, user.id, refreshToken]);
        await connection.execute('UPDATE business_user_tokens SET access_token_generation_time = CURRENT_TIMESTAMP WHERE user_id = ? AND refresh_token = ?', [user.id, newRefreshToken]);
        await connection.execute('UPDATE business_users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
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

    return { data: { accessToken: newAccessToken, refreshToken: newRefreshToken }
    };
  }

  static async postChangeLanguageAsync(refreshToken, language) {
    // check request body validity
    if (typeof refreshToken !== 'string' || typeof language !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // verify refreshToken validity
    let user;
    try { 
      user = await jwtVerifyAsync(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const connection = await pool.getConnection();
    try {
      // verify if token exists
      const userTokens = (await connection.execute('SELECT refresh_token FROM business_user_tokens WHERE user_id = ? AND refresh_token = ?', [user.id, refreshToken]))[0];
      if (userTokens.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      const [result] = await connection.execute('UPDATE business_user_tokens SET language = ? WHERE refresh_token = ?', [language, refreshToken]);
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: { msg: 'Language changed successfully' } };
  }

  static async getEmailAsync(accessToken) {
    // check request body validity
    if (typeof accessToken !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const [[email]] = await pool.execute('SELECT email FROM business_users WHERE id = ?', [user.id]);
    if (!email) return { errors: [{ msg: 'Unauthorized' }] };

    return { data: { email: email.email } };
  }
  
  static async postBusinessEmailAsync(accessToken, newEmail) {
    // check request body validity
    if (typeof accessToken !== 'string' || typeof newEmail !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    newEmail = newEmail.trim();

    const errors = [];
    // check email input field
    if (newEmail.length === 0) {
      errors.push({ value: newEmail, param: 'email', msg: 'Empty value' });
    } else if (!/^[a-zA-Z0-9]+([\.\-!#$%&'*+\/=?^_`{|}~]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([\.-]?[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,6})+$/.test(newEmail)) {
      errors.push({ value: newEmail, param: 'email', msg: 'Invalid value' });
    }
    if (errors.length > 0) {
      return { errors: errors };
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
      // Getting current email
      const [[email]] = await connection.execute('SELECT email FROM business_users WHERE id = ?', [user.id]);
      if (!email) return { errors: [{ msg: 'Unauthorized' }] };

      // Check if user with this email does not already exist
      if (newEmail !== email.email) {
        const [users] = await connection.execute('SELECT email FROM business_users WHERE email = ?', [newEmail]);
        if (users.length > 0) {
          return { errors: [{ value: newEmail, param: 'email', msg: 'Already exists' }]};
        }
      }

      // Updating email
      const [result] = await connection.execute('UPDATE business_users SET email = ? WHERE id = ?', [newEmail, user.id]);
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: { msg: 'Email changed successfully' } };
  }

  static async postDeleteBusinessAccountAsync(accessToken, businessName) {
    // check request body validity
    if (typeof accessToken !== 'string' || typeof businessName !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    businessName = businessName.trim();

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
      // Getting business name
      const [[users]] = await connection.execute('SELECT shop_id, role FROM business_users WHERE id = ?', [user.id]);
      if (!users) return { errors: [{ msg: 'Unauthorized' }] };

      // Checking permission for deleting
      if (users.role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      const [[shop]] = await connection.execute('SELECT title FROM shops WHERE id = ?', [users.shop_id]);
      if (!shop) return { errors: [{ msg: 'Unauthorized' }] };

      if (businessName !== shop.title) return { status: 'FAILED', errors: [{ param: 'businessName', msg: 'Invalid value' }] };

      // deleting shop from database
      const [result] = await connection.execute('DELETE FROM shops WHERE id = ?', [users.shop_id]);

      // deleting all shop images from Google Cloud Storage
      await allShopImagesDeletionFromGcStorageAsync(users.shop_id);

      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }

    return { data: { msg: 'Account deleted successfully' } };
  }

  static async getUsersAsync(accessToken) {
    // check request body validity
    if (typeof accessToken !== 'string') {
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
    let users;
    try {
      // check if user exists
      const [result] = (await connection.execute('SELECT shop_id, role FROM business_users WHERE id = ?', [user.id]));
      if (result.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // checking permission for editing
      if (result[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      // get users
      [users] = (await connection.execute('SELECT id, email FROM business_users WHERE shop_id = ? AND id != ?', [result[0].shop_id, user.id]));
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: users };
  }

  static async postDeleteUserAsync(accessToken, userId) {
    // check request body validity
    if (typeof accessToken !== 'string' || typeof userId !== 'number') {
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
      // check if user exists
      const [users] = (await connection.execute('SELECT shop_id, role FROM business_users WHERE id = ?', [user.id]));
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      const [result] = await connection.execute('DELETE FROM business_users WHERE id = ? AND shop_id = ?', [userId, users[0].shop_id]);
      if (result.affectedRows === 0) return { errors: [{ msg: 'User do not exist', userId: userId }] };
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return {data: { msg: 'Location deleted successfully' }};
  }

  static async postAddUserAsync(accessToken, email, password, confirmPassword) {

    // check auth properties validity
    if (typeof accessToken !== 'string' || typeof email !== 'string' || typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    email = email.trim();

    // verify accessToken validity
    let user;
    try { 
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    const errors = [];

    // check email input field
    if (email.length === 0) {
      errors.push({ value: email, param: 'email', msg: 'Empty value' });
    } else if (!/^[a-zA-Z0-9]+([\.\-!#$%&'*+\/=?^_`{|}~]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([\.-]?[a-zA-Z0-9]+)*(\.[a-zA-Z]{2,6})+$/.test(email)) {
      errors.push({ value: email, param: 'email', msg: 'Invalid value' });
    }

    // check password input field
    let errorInPassword = false;
    if (password.length === 0) {
      errors.push({ param: 'password', msg: 'Empty value' });
      errorInPassword = true;
    } else if (password.length < 6) {
      errors.push({ param: 'password',msg: 'Value is to short' });
      errorInPassword = true;
    }

    // check confirmPassword input field
    if (confirmPassword.length === 0) {
      errors.push({ param: 'confirmPassword', msg: 'Empty value' });
      errorInPassword = true;
    }

    // check if password and confirmPassword are equal
    if (!errorInPassword) {
      if (password !== confirmPassword) {
        errors.push({ param: 'password, confirmPassword', msg: 'Values are not equal' });
      }
    }

    if (errors.length > 0) {
      return { errors: errors };
    }

    const connection = await pool.getConnection();
    let insertId;
    try {
      // getting user data
      const [users] = (await connection.execute('SELECT shop_id, role FROM business_users WHERE id = ?', [user.id]));
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      // Validate if user does not already exist
      const [result] = await connection.execute('SELECT email FROM business_users WHERE email = ?', [email]);
      if (result.length > 0) {
        return { errors: [{ value: email, param: 'email', msg: 'Already exists' }]};
      }

      // Hash the password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Save data in shops and business_users tables
      insertId = (await connection.execute('INSERT INTO business_users (shop_id, email, password, role) VALUES (?, ?, ?, ?)', [users[0].shop_id, email, hashedPassword, 'manager']))[0].insertId;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return { data: { msg: 'User added successfully', userId: insertId } };
  }

  static async resetPasswordAsync(email, appLanguage) {
    // check auth properties validity
    if (typeof email !== 'string' || typeof appLanguage !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    appLanguage = appLanguage.trim();
    email = email.trim();
    
    const text = getLocalizedText(appLanguage);

    // check email input field
    if (email.length === 0) {
      return { errors: [{ value: email, param: 'email', msg: 'Empty value' }] };
    }

    const connection = await pool.getConnection();
    try {

      // Validate if user does not already exist
      const [users] = await connection.execute('SELECT id, email FROM business_users WHERE email = ?', [email]);
      if (users.length === 0) {
        return { errors: [{ value: email, param: 'email', msg: 'User with this email do not exist' }]};
      }

      const newPassword = require('crypto').randomBytes(10).toString('hex');

      // Hash the password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      try {
        await connection.query('START TRANSACTION');
        await connection.execute('DELETE FROM business_user_tokens WHERE user_id = ?', [users[0].id]);
        await connection.execute('UPDATE business_users SET password = ? WHERE id = ?', [hashedPassword, users[0].id]);

        const transporter = nodemailer.createTransport({
          host: process.env.ZOHO_HOST,
          secure: true,
          port: 465,
          auth: {
            user: process.env.ZOHO_EMAIL_ADDRESS,
            pass: process.env.ZOHO_PASSWORD,
          },
        });
        const mailOptions = {
          from: process.env.ZOHO_EMAIL_ADDRESS,
          to: email,
          subject: text.yourNewPassword,
          html: `<p>${text.signInWithNewPassword}</p><p>${newPassword}</p>`,
        };
        const info = await transporter.sendMail(mailOptions);

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

    return { data: { msg: 'Password reseted successfully' } };
  }
}