const { Storage } = require('@google-cloud/storage');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

exports.shopImageUploadToGcStorageAsync = async (file, shopId) => {
  const storage = new Storage({ keyFilename: path.join(__dirname, '..', 'dely-app-backend-836c6fd292d9-gcp-sakey.json') });

  // creating file name
  const fileNameSplited = file.originalname.split('.');
  const fileExtension = fileNameSplited[fileNameSplited.length - 1];
  const urlSecondPart = `shop-${shopId}/cover-image/${uuidv4()}.${fileExtension}`;
  const imageUrl = `${process.env.GCSTORAGE_BUCKET_URL}${urlSecondPart}`;

  try {
    // listing objects in bucket
    const [files] = await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).getFiles({ prefix: `shop-${shopId}/cover-image/` });

    // delete objects from bucket
    for (let i = 0; i < files.length; i++) {
      await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).file(files[i].name).delete();
    }
    
    // adding object to bucket
    await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).file(urlSecondPart).save(file.buffer);

    // if no errors return image url
    return imageUrl;
  } catch (error) {
    throw Error('Something went wrong while saving shop image to Google Cloud Storage');
  }
};

exports.productImageUploadToGcStorageAsync = async (file, shopId, productId) => {
  const storage = new Storage({ keyFilename: path.join(__dirname, '..', 'dely-app-backend-836c6fd292d9-gcp-sakey.json') });

  // creating file name
  const fileNameSplited = file.originalname.split('.');
  const fileExtension = fileNameSplited[fileNameSplited.length - 1];
  const urlSecondPart = `shop-${shopId}/products/product-${productId}/${uuidv4()}.${fileExtension}`;
  const imageUrl = `${process.env.GCSTORAGE_BUCKET_URL}${urlSecondPart}`;

  try {
    // listing objects in bucket
    const [files] = await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).getFiles({ prefix: `shop-${shopId}/products/product-${productId}/` });

    // delete objects from bucket
    for (let i = 0; i < files.length; i++) {
      await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).file(files[i].name).delete();
    }
    
    // adding object to bucket
    await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).file(urlSecondPart).save(file.buffer);

    // if no errors return image url
    return imageUrl;
  } catch (error) {
    throw Error('Something went wrong while saving product image to Google Cloud Storage');
  }
};

exports.productImageDeletionFromGcStorageAsync = async (shopId, productId) => {
  const storage = new Storage({ keyFilename: path.join(__dirname, '..', 'dely-app-backend-836c6fd292d9-gcp-sakey.json') });

  try {
    // listing objects in bucket
    const [files] = await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).getFiles({ prefix: `shop-${shopId}/products/product-${productId}/` });

    // delete objects from bucket
    for (let i = 0; i < files.length; i++) {
      await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).file(files[i].name).delete();
    }
  } catch (error) {
    throw Error('Something went wrong while deleting product image from Google Cloud Storage');
  }
};

exports.allShopImagesDeletionFromGcStorageAsync = async (shopId) => {
  const storage = new Storage({ keyFilename: path.join(__dirname, '..', 'dely-app-backend-836c6fd292d9-gcp-sakey.json') });

  try {
    // listing objects in bucket
    const [files] = await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).getFiles({ prefix: `shop-${shopId}/` });

    // delete objects from bucket
    for (let i = 0; i < files.length; i++) {
      await storage.bucket(process.env.GCSTORAGE_BUCKET_NAME).file(files[i].name).delete();
    }
  } catch (error) {
    throw Error('Something went wrong while deleting all images from Google Cloud Storage');
  }
};