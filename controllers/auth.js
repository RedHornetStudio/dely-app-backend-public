const Auth = require('../models/auth');

exports.postBusinessSignUp = (req, res, next) => {
  (async () => {
    try {
      const auth = new Auth(req.body.country, req.body.currency, req.body.businessName, req.body.email, req.body.password, req.body.confirmPassword, req.body.pushToken, req.body.language);
      const response = await auth.businessSignUpAsync();
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

exports.postBusinessSignIn = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.businessSignInAsync(req.body.email, req.body.password, req.body.pushToken, req.body.language);
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

exports.getBusinessAccessToken = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.getBusinessAccessTokenAsync(req.body.refreshToken);
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

exports.postPushToken = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postPushTokenAsync(req.body.refreshToken, req.body.pushToken);
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

exports.postBusinessSignOut = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postBusinessSignOutAsync(req.body.refreshToken);
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

exports.postBusinessPassword = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postBusinessPasswordAsync(req.body.refreshToken, req.body.oldPassword, req.body.newPassword, req.body.newConfirmPassword);
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

exports.postChangeLanguage = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postChangeLanguageAsync(req.body.refreshToken, req.body.language);
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

exports.getEmail = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.getEmailAsync(req.body.accessToken, req.body.email);
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

exports.postBusinessEmail = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postBusinessEmailAsync(req.body.accessToken, req.body.email);
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

exports.postDeleteBusinessAccount = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postDeleteBusinessAccountAsync(req.body.accessToken, req.body.businessName);
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

exports.getUsers = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.getUsersAsync(req.body.accessToken);
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

exports.postDeleteUser = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postDeleteUserAsync(req.body.accessToken, req.body.userId);
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

exports.postAddUser = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.postAddUserAsync(req.body.accessToken, req.body.email, req.body.password, req.body.confirmPassword);
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

exports.resetPassword = (req, res, next) => {
  (async () => {
    try {
      const response = await Auth.resetPasswordAsync(req.body.email, req.body.appLanguage);
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