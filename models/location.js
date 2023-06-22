const bigDecimal = require('js-big-decimal');

const pool = require('../util/database');
const { jwtVerifyAsync } = require('../util/functions');

module.exports = class Location {
  constructor(accessToken, city, address, phoneNumber, delivery, inPlace, takeAway, workingHours, deliveryPrice, timeZone) {
    this.accessToken = accessToken
    this.city = typeof city === 'string' ? city.trim() : city;
    this.address = typeof address === 'string' ? address.trim() : address;
    this.phoneNumber = typeof phoneNumber === 'string' ? phoneNumber.trim() : phoneNumber;
    this.delivery = delivery;
    this.inPlace = inPlace;
    this.takeAway = takeAway;
    this.workingHours = workingHours;
    this.deliveryPrice = deliveryPrice;
    this.timeZone = typeof timeZone === 'string' ? timeZone.trim() : timeZone;
  }

  async postAddLocationAsync() {
    // check location properties validity
    if (typeof this.accessToken !== 'string' || typeof this.city !== 'string' || typeof this.address !== 'string' || typeof this.phoneNumber !== 'string' || typeof this.delivery !== 'boolean' || typeof this.inPlace !== 'boolean' || typeof this.takeAway !== 'boolean' || typeof this.workingHours !== 'object' || typeof this.deliveryPrice !== 'string' || typeof this.timeZone !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }
    
    let user;
    try {
      user = await jwtVerifyAsync(this.accessToken, process.env.ACCESS_TOKEN_SECRET);
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
      // check city field
      if (this.city.length === 0) {
        errors.push({ value: this.city, param: 'city', msg: 'Empty value' });
      }

      // check address field
      if (this.address.length === 0) {
        errors.push({ value: this.address, param: 'address', msg: 'Empty value' });
      }

      // check phoneNumber field
      if (this.phoneNumber.length === 0) {
        errors.push({ value: this.phoneNumber, param: 'phoneNumber', msg: 'Empty value' });
      } else if (!/^\+?[0-9]+$/.test(this.phoneNumber)) {
        errors.push({ value: this.phoneNumber, param: 'phoneNumber', msg: 'Invalid value' });
      }

      // check delivery methods
      if (this.delivery === false && this.inPlace === false && this.takeAway === false) {
        errors.push({ param: 'deliveryMethods', msg: 'Not chosen' });
      }

      // check delivery price input
      if (this.delivery && this.deliveryPrice.length === 0) {
        errors.push({ param: 'deliveryPrice', msg: 'Empty value' });
      } else if (this.delivery && !/^[0-9]+(\.[0-9]+)?$/.test(this.deliveryPrice)) {
        errors.push({ value: this.deliveryPrice, param: 'deliveryPrice', msg: 'Invalid value' });
      }

      const workingHoursFormated = {};
      // check working hours
      Object.entries(this.workingHours).forEach(([key, value]) => {
        const startHourTrimed = value.startHour.trim();
        const startMinuteTrimed = value.startMinute.trim();
        const endHourTrimed = value.endHour.trim();
        const endMinuteTrimed = value.endMinute.trim();
        if (startHourTrimed === '' && startMinuteTrimed === '' && endHourTrimed === '' && endMinuteTrimed === '') {
          workingHoursFormated[key] = 'closed';
          return
        }

        if (startHourTrimed.length > 2 || startMinuteTrimed.length > 2 || endHourTrimed.length > 2 || endMinuteTrimed.length > 2) {
          errors.push({ param: key, msg: 'Invalid value' });
          return;
        }

        const startHour = parseInt(startHourTrimed);
        const startMinute = parseInt(startMinuteTrimed);
        const endHour = parseInt(endHourTrimed);
        const endMinute = parseInt(endMinuteTrimed);
        if (startHour < 0 || startHour > 23 || isNaN(startHour) ||
          startMinute < 0 || startMinute > 59 || isNaN(startMinute) ||
          endHour < 0 || endHour > 23 || isNaN(endHour) ||
          endMinute < 0 || endMinute > 59 || isNaN(endMinute)
        ) {
          errors.push({ param: key, msg: 'Invalid value' });
          return;
        }

        const startHourTime = startHourTrimed.length === 1 ? `0${startHourTrimed}` : startHourTrimed;
        const startMinuteTime = startMinuteTrimed.length === 1 ? `0${startMinuteTrimed}` : startMinuteTrimed;
        const endHourTime = endHourTrimed.length === 1 ? `0${endHourTrimed}` : endHourTrimed;
        const endMinuteTime = endMinuteTrimed.length === 1 ? `0${endMinuteTrimed}` : endMinuteTrimed;
        const startTime = `${startHourTime}:${startMinuteTime}`;
        const endTime = `${endHourTime}:${endMinuteTime}`;
        // if (startTime >= endTime) {
        //   errors.push({ param: key, msg: 'Invalid value' });
        //   return;
        // }

        workingHoursFormated[key] = `${startTime}-${endTime}`;
      });
      
      if (errors.length > 0) {
        return { errors: errors };
      }

      // inserting location in locations table and inserting workingHours in working_hours table
      try {
        await connection.query('START TRANSACTION');

        const location = (await connection.execute('INSERT INTO locations (shop_id, city, address, phone_number, delivery_method_delivery, delivery_method_in_place, delivery_method_take_away, delivery_price, time_zone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [users[0].shop_id, this.city, this.address, this.phoneNumber, this.delivery, this.inPlace, this.takeAway, new bigDecimal(this.deliveryPrice).round(2).getValue(), this.timeZone]))[0];
        const locationId = location.insertId;

        // inserting working hours
        const working_hours = (await connection.execute('INSERT INTO working_hours(location_id, sunday, monday, tuesday, wednesday, thursday, friday, saturday) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [locationId, workingHoursFormated.sunday, workingHoursFormated.monday, workingHoursFormated.tuesday, workingHoursFormated.wednesday, workingHoursFormated.thursday, workingHoursFormated.friday, workingHoursFormated.saturday]))[0];

        // insertin in location_notifications
        const [result] = await connection.execute('INSERT INTO location_notifications (location_id, user_id) VALUES (?, ?)', [locationId, user.id]);

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
  
    return {data: { msg: 'Location added successfully' }};
  }

  static async postEditLocationAsync(accessToken, id, city, address, phoneNumber, delivery, inPlace, takeAway, workingHours, deliveryPrice, timeZone) {
    // check location properties validity
    if (typeof accessToken !== 'string' || typeof id !== 'number' || typeof city !== 'string' || typeof address !== 'string' || typeof phoneNumber !== 'string' || typeof delivery !== 'boolean' || typeof inPlace !== 'boolean' || typeof takeAway !== 'boolean' || typeof workingHours !== 'object' || typeof deliveryPrice !== 'string' || typeof timeZone !== 'string') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

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
      // check city field
      if (city.length === 0) {
        errors.push({ value: city, param: 'city', msg: 'Empty value' });
      }

      // check address field
      if (address.length === 0) {
        errors.push({ value: address, param: 'address', msg: 'Empty value' });
      }

      // check phoneNumber field
      if (phoneNumber.length === 0) {
        errors.push({ value: phoneNumber, param: 'phoneNumber', msg: 'Empty value' });
      } else if (!/^\+?[0-9]+$/.test(phoneNumber)) {
        errors.push({ value: phoneNumber, param: 'phoneNumber', msg: 'Invalid value' });
      }

      // check deliver methods
      if (delivery === false && inPlace === false && takeAway === false) {
        errors.push({ param: 'deliveryMethods', msg: 'Not chosen' });
      }

      // check delivery price input
      if (delivery && deliveryPrice.length === 0) {
        errors.push({ param: 'deliveryPrice', msg: 'Empty value' });
      } else if (delivery && !/^[0-9]+(\.[0-9]+)?$/.test(deliveryPrice)) {
        errors.push({ value: deliveryPrice, param: 'deliveryPrice', msg: 'Invalid value' });
      }

      const workingHoursFormated = {};
      // check working hours
      Object.entries(workingHours).forEach(([key, value]) => {
        const startHourTrimed = value.startHour.trim();
        const startMinuteTrimed = value.startMinute.trim();
        const endHourTrimed = value.endHour.trim();
        const endMinuteTrimed = value.endMinute.trim();
        if (startHourTrimed === '' && startMinuteTrimed === '' && endHourTrimed === '' && endMinuteTrimed === '') {
          workingHoursFormated[key] = 'closed';
          return
        }

        if (startHourTrimed.length > 2 || startMinuteTrimed.length > 2 || endHourTrimed.length > 2 || endMinuteTrimed.length > 2) {
          errors.push({ param: key, msg: 'Invalid value' });
          return;
        }

        const startHour = parseInt(startHourTrimed);
        const startMinute = parseInt(startMinuteTrimed);
        const endHour = parseInt(endHourTrimed);
        const endMinute = parseInt(endMinuteTrimed);
        if (startHour < 0 || startHour > 23 || isNaN(startHour) ||
          startMinute < 0 || startMinute > 59 || isNaN(startMinute) ||
          endHour < 0 || endHour > 23 || isNaN(endHour) ||
          endMinute < 0 || endMinute > 59 || isNaN(endMinute)
        ) {
          errors.push({ param: key, msg: 'Invalid value' });
          return;
        }

        const startHourTime = startHourTrimed.length === 1 ? `0${startHourTrimed}` : startHourTrimed;
        const startMinuteTime = startMinuteTrimed.length === 1 ? `0${startMinuteTrimed}` : startMinuteTrimed;
        const endHourTime = endHourTrimed.length === 1 ? `0${endHourTrimed}` : endHourTrimed;
        const endMinuteTime = endMinuteTrimed.length === 1 ? `0${endMinuteTrimed}` : endMinuteTrimed;
        const startTime = `${startHourTime}:${startMinuteTime}`;
        const endTime = `${endHourTime}:${endMinuteTime}`;
        // if (startTime >= endTime) {
        //   errors.push({ param: key, msg: 'Invalid value' });
        //   return;
        // }

        workingHoursFormated[key] = `${startTime}-${endTime}`;
      });
      
      if (errors.length > 0) {
        return { errors: errors };
      }

      // inserting location in locations table and inserting workingHours in working_hours table
      try {
        await connection.query('START TRANSACTION');

        const location = (await connection.execute('UPDATE locations SET city = ?, address = ?, phone_number = ?, delivery_method_delivery = ?, delivery_method_in_place = ?, delivery_method_take_away = ?, delivery_price = ?, time_zone = ? WHERE id = ? AND shop_id = ?', [city, address, phoneNumber, delivery, inPlace, takeAway, new bigDecimal(deliveryPrice).round(2).getValue(), timeZone, id, users[0].shop_id]))[0];
        if (location.affectedRows === 0) {
          await connection.query("ROLLBACK");
          return { errors: [{ msg: 'Location do not exist', locationId: id }] };
        }

        // inserting working hours
        const working_hours = (await connection.execute('UPDATE working_hours SET sunday = ?, monday = ?, tuesday = ?, wednesday = ?, thursday = ?, friday = ?, saturday = ? WHERE location_id = ?', [workingHoursFormated.sunday, workingHoursFormated.monday, workingHoursFormated.tuesday, workingHoursFormated.wednesday, workingHoursFormated.thursday, workingHoursFormated.friday, workingHoursFormated.saturday, id]))[0];

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
  
    return {data: { msg: 'Location edited successfully' }};
  }

  static async postDeleteLocationAsync(locationId, accessToken) {
    // check request body validity
    if (typeof locationId !== 'number') {
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
      // getting user data
      const users = (await connection.execute('SELECT shop_id, role FROM business_users WHERE id = ?', [user.id]))[0];
      if (users.length === 0) {
        return { errors: [{ msg: 'Unauthorized' }] };
      }

      // checking permission for editing
      if (users[0].role !== 'admin') return { errors: [{ msg: 'Permission denied' }] };

      // deleting location from database
      const location = (await connection.execute('DELETE FROM locations WHERE id = ? AND shop_id = ?', [locationId, users[0].shop_id]))[0];
      if (location.affectedRows === 0) return { errors: [{ msg: 'Location do not exist', locationId: locationId }] };
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }

    return {data: { msg: 'Location deleted successfully' }};
  }

  static async getLocationsAsync(shopId) {
    if (typeof shopId !== 'number') {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // request from database locations where shopId === shopId with fields id, shopId, city, address, opened, deliveryMethods
    const connection = await pool.getConnection();
    let locations = [];
    try {
      locations = (await connection.execute('SELECT * FROM locations WHERE shop_id = ?', [shopId]))[0];
      for (let i = 0; i < locations.length; i++) {
        const workingHours = (await connection.execute('SELECT * FROM working_hours WHERE location_id = ?', [locations[i].id]))[0];
        const refactoredWorkingHours = {
          '0': workingHours[0].sunday,
          '1': workingHours[0].monday,
          '2': workingHours[0].tuesday,
          '3': workingHours[0].wednesday,
          '4': workingHours[0].thursday,
          '5': workingHours[0].friday,
          '6': workingHours[0].saturday
        };
        locations[i].working_hours = refactoredWorkingHours;
        let shopOpened = false;
        const dateInSpecificTimeZone = new Date(new Date().toLocaleString('en-US', { timeZone: locations[i].time_zone }));
        let todayWorkingTimes = refactoredWorkingHours[dateInSpecificTimeZone.getDay()];;
        let yesterdayDayNumber = dateInSpecificTimeZone.getDay();
        yesterdayDayNumber === 0
          ? yesterdayDayNumber = 6
          : yesterdayDayNumber = yesterdayDayNumber - 1;
        const yesterdayWorkingTimes = refactoredWorkingHours[yesterdayDayNumber];
        if (yesterdayWorkingTimes !== 'closed') {
          const yesterdayOpenTime = yesterdayWorkingTimes.split('-')[0];
          const yesterdayCloseTime = yesterdayWorkingTimes.split('-')[1];
          let dateInSpecificTimeZoneHours = dateInSpecificTimeZone.getHours().toString();
          let dateInSpecificTimeZoneMinutes = dateInSpecificTimeZone.getMinutes().toString();
          dateInSpecificTimeZoneHours = dateInSpecificTimeZoneHours.length === 1 ? `0${dateInSpecificTimeZoneHours}` : dateInSpecificTimeZoneHours;
          dateInSpecificTimeZoneMinutes = dateInSpecificTimeZoneMinutes.length === 1 ? `0${dateInSpecificTimeZoneMinutes}` : dateInSpecificTimeZoneMinutes;
          const dateInSpecificTimeZoneTime = `${dateInSpecificTimeZoneHours}:${dateInSpecificTimeZoneMinutes}`;
          if (yesterdayCloseTime <= yesterdayOpenTime && yesterdayCloseTime !== '00:00' && dateInSpecificTimeZoneTime < yesterdayCloseTime) {
            shopOpened = true;
            todayWorkingTimes = yesterdayWorkingTimes;
          }
        }
        locations[i].todayWorkingTimes = todayWorkingTimes;
        if (!shopOpened) {
          if (todayWorkingTimes !== 'closed') {
            const openTime = todayWorkingTimes.split('-')[0];
            const closeTime = todayWorkingTimes.split('-')[1];
            const openTimeDate = new Date(dateInSpecificTimeZone.getFullYear(), dateInSpecificTimeZone.getMonth(), dateInSpecificTimeZone.getDate(), parseInt(openTime.split(':')[0]), parseInt(openTime.split(':')[1]), 0);
            let closeTimeDate = null;
            closeTime <= openTime
              ? closeTimeDate = new Date(dateInSpecificTimeZone.getFullYear(), dateInSpecificTimeZone.getMonth(), dateInSpecificTimeZone.getDate(), 24, 0, 0)
              : closeTimeDate = new Date(dateInSpecificTimeZone.getFullYear(), dateInSpecificTimeZone.getMonth(), dateInSpecificTimeZone.getDate(), parseInt(closeTime.split(':')[0]), parseInt(closeTime.split(':')[1]), 0);
            shopOpened = dateInSpecificTimeZone.getTime() >= openTimeDate.getTime() && dateInSpecificTimeZone.getTime() <= closeTimeDate.getTime() ? true : false;
          }
        }
        locations[i].opened = shopOpened;
      }
    } catch (error) {
      throw new Error(error);
    } finally {
      connection.release();
    }

    return { data: locations };
  }

  static async getLocationsWithNotificationsAsync(accessToken) {
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

    // request from database locations with notifications
    const connection = await pool.getConnection();
    let locations = [];
    try {
      // check if user exists
      const [users] = await connection.execute('SELECT shop_id FROM business_users WHERE id = ?', [user.id]);
      if (users.length === 0) return { errors: [{ msg: 'Unauthorized' }] };

      // getting locations
      [locations] = await connection.execute('SELECT * FROM locations WHERE shop_id = ?', [users[0].shop_id]);
      for (let i = 0; i < locations.length; i++) {
        const workingHours = (await connection.execute('SELECT * FROM working_hours WHERE location_id = ?', [locations[i].id]))[0];
        const refactoredWorkingHours = {
          '0': workingHours[0].sunday,
          '1': workingHours[0].monday,
          '2': workingHours[0].tuesday,
          '3': workingHours[0].wednesday,
          '4': workingHours[0].thursday,
          '5': workingHours[0].friday,
          '6': workingHours[0].saturday
        };
        const dateInSpecificTimeZone = new Date(new Date().toLocaleString('en-US', { timeZone: locations[i].time_zone }));
        let todayWorkingTimes = refactoredWorkingHours[dateInSpecificTimeZone.getDay()];
        locations[i].todayWorkingTimes = todayWorkingTimes;
        const [notification] = await connection.execute('SELECT id FROM location_notifications WHERE location_id = ? AND user_id = ?', [locations[i].id, user.id]);
        locations[i].notificationEnabled = notification.length > 0;
      }
    } catch (error) {
      throw new Error(error);
    } finally {
      connection.release();
    }

    return { data: locations };
  }

  static async postNotificationsAsync(accessToken, notifications) {
    if (typeof accessToken !== 'string' || !Array.isArray(notifications)) {
      return { errors: [{ msg: 'Invalid request body' }] };
    }

    // verify accessToken validity
    let user;
    try {
      user = await jwtVerifyAsync(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      return { errors: [{ msg: 'Unauthorized' }] };
    }

    // request from database locations with notifications
    const connection = await pool.getConnection();
    try {
      await connection.query('START TRANSACTION');

      // check if user exists
      const [users] = await connection.execute('SELECT shop_id FROM business_users WHERE id = ?', [user.id]);
      if (users.length === 0) return { errors: [{ msg: 'Unauthorized' }] };

      for (let i = 0; i < notifications.length; i++) {
        const [locations] = await connection.execute('SELECT shop_id FROM locations WHERE id = ? AND shop_id = ?', [notifications[i].locationId, users[0].shop_id]);
        if (locations.length === 0) {
          await connection.query("ROLLBACK");
          return { errors: [{ msg: 'Location do not exist', locationId: notifications[i].locationId }] };
        }
        const [locationAndUser] = await connection.execute('SELECT id FROM location_notifications WHERE location_id = ? AND user_id = ?', [notifications[i].locationId, user.id]);
        if (notifications[i].notificationEnbaled === true && locationAndUser.length === 0) {
          const [result] = await connection.execute('INSERT INTO location_notifications (location_id, user_id) VALUES (?, ?)', [notifications[i].locationId, user.id]);
        } else if (notifications[i].notificationEnbaled === false && locationAndUser.length > 0) {
          const [result] = await connection.execute('DELETE FROM location_notifications WHERE location_id = ? AND user_id = ?', [notifications[i].locationId, user.id]);
        }
      }

      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw new Error(error);
    } finally {
      connection.release();
    }

    return { data: { msg: 'Notifications saved successfully' } };
  }
}