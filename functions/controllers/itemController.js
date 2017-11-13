const admin = require('../apiClients/firebaseClient');

exports.deleteItemFromDB = itemId =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`items/${itemId}`)
      .remove()
      .then(resolve())
      .catch(err => reject(err));
  });

exports.getItemFromDB = itemId =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`items/${itemId}`)
      .once('value')
      .then(snapshot => resolve(snapshot.val()))
      .catch(err => reject(err));
  });

exports.getItemTransactionsFromDB = itemId =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`items/${itemId}/transactions`)
      .once('value')
      .then(snapshot => resolve(snapshot.val()))
      .catch(err => reject(err));
  });

exports.addTransactionsByDate = (itemId, date, transactions) =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`/items/${itemId}/transactions/${date}`)
      .update(transactions)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.getUserIdByItemFromDB = itemId =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`items/${itemId}/uniqueUserId`)
      .once('value')
      .then(snapshot => resolve(snapshot.val()))
      .catch(err => reject(err));
  });

exports.addDataToItem = (itemId, dataToAdd) =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`items/${itemId}`)
      .set(dataToAdd)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.removeTransactions = (itemId, dateAndId1, dateAndId2) =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`items/${itemId}/transactions/${dateAndId1}/${dateAndId2}`)
      .remove()
      .then(resolve())
      .catch(err => reject(err));
  });
