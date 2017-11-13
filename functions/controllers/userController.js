const admin = require('../apiClients/firebaseClient');

const userRef = uniqueUserId => admin.database()
  .ref(`users/${uniqueUserId}`);

exports.doesUserExist = uniqueUserId =>
  new Promise((resolve, reject) => {
    console.log('does user exist called');
    userRef(uniqueUserId).once('value')
      .then(snapshot => resolve(snapshot))
      .catch(err => reject(err));
  });

exports.getUserFromDB = uniqueUserId =>
  new Promise((resolve, reject) => {
    userRef(uniqueUserId)
      .once('value')
      .then(snapshot => resolve(snapshot.val()))
      .catch(err => reject(err));
  });

exports.getUserItems = uniqueUserId =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`users/${uniqueUserId}/items`)
      .once('value')
      .then(snapshot => resolve(snapshot))
      .catch(err => reject(err));
  });

exports.getUserProfile = uniqueUserId =>
  new Promise((resolve, reject) => {
    admin.auth()
      .getUser(uniqueUserId)
      .then(userRecord => resolve(userRecord.toJSON()))
      .catch(err => reject(err));
  });

exports.initializeUser = (uniqueUserId, payload) =>
  new Promise((resolve, reject) => {
    userRef(uniqueUserId)
      .set(payload)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.updateUser = (uniqueUserId, newData) =>
  new Promise((resolve, reject) => {
    userRef(uniqueUserId)
      .update(newData)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.deleteUserInAuth = uniqueUserId =>
  new Promise((resolve, reject) => {
    admin.auth()
      .deleteUser(uniqueUserId)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.deleteUserFromDB = uniqueUserId =>
  new Promise((resolve, reject) => {
    userRef(uniqueUserId)
      .remove()
      .then(resolve())
      .catch(err => reject(err));
  });

exports.getDatesToScheduleFromDB = uniqueUserId =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`users/${uniqueUserId}/datesToSchedule`)
      .once('value')
      .then(snapshot => resolve(snapshot.val()))
      .catch(err => reject(err));
  });


exports.updateScheduledEvents = (uniqueUserId, newEvents) =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`users/${uniqueUserId}/scheduledEvents`)
      .update(newEvents)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.updateEventsToDelete = (uniqueUserId, eventsToDelete) =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`users/${uniqueUserId}/eventsToDelete`)
      .set(eventsToDelete)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.addItemsToUser = (uniqueUserId, itemId, institutionName) =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`users/${uniqueUserId}/items/${itemId}`)
      .set(institutionName)
      .then(resolve())
      .catch(err => reject(err));
  });

exports.updateDatesToSchedule = (uniqueUserId, transactionsToRemove) =>
  new Promise((resolve, reject) => {
    admin.database()
      .ref(`users/${uniqueUserId}/datesToSchedule`)
      .set(transactionsToRemove)
      .then(resolve())
      .catch(err => reject(err));
  });


// module.exports = { doesUserExist,
//   getUserFromDB,
//   getUserItems,
//   getUserProfile,
//   initializeUser,
//   updateUser,
//   deleteUserInAuth,
//   deleteUserFromDB,
//   getDatesToScheduleFromDB,
//   updateScheduledEvents,
//   updateEventsToDelete,
//   addItemsToUser,
//   updateDatesToSchedule,
// };
