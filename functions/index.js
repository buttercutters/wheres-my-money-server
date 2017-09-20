const dotenv = require('dotenv');
dotenv.config();
const functions = require('firebase-functions');
const admin = require('./apiClients/firebaseClient.js');
const moment = require('moment');
const axios = require('axios');
const google = require('googleapis');
const Promise = require('bluebird');
const googleClient = require('./apiClients/googleClient.js');
const plaidClient = require('./apiClients/plaidClient.js');

//* **************** ADD USER *********************//
exports.addUser = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const idToken = request.body.idToken;
  const OAuthToken = request.body.OAuthToken;

  // verifies firebase idToken
  admin.auth().verifyIdToken(idToken)
    .then((decodedToken) => {
      const uniqueUserId = decodedToken.uid;
      const ref = admin.database().ref(`users/${uniqueUserId}`);

      // searches for uniqueUserId in db
      // if user exists response is ended
      // otherwise a new user is created in db,
      // a new calendar is created,
      // calendarId is saved in db
      ref.once('value')
        .then((snapshot) => {
          if (snapshot.exists()) { response.json(); } else {
            admin.auth().getUser(uniqueUserId)
              .then((userRecord) => {
                const user = userRecord.toJSON();
                const payload = {
                  email: user.email,
                  name: user.displayName,
                  OAuthToken,
                };
                admin.database().ref(`users/${uniqueUserId}`).set(payload)
                  .then(() => {
                    const config = {
                      url: 'http://localhost:5000/testproject-6177f/us-central1/createNewCalendar',
                      payload: { OAuthToken },
                    };
                    axios.post(config.url, config.payload)
                      .then((calendar) => {
                        const calId = calendar.data.id;
                        const calName = calendar.data.summary;
                        admin.database().ref(`users/${uniqueUserId}`).update({ calendarId: calId, calendarName: calName });
                      });
                  });
              }).then(response.end(''))
              .catch(error => console.log('Error fetching user data:', error));
          }
        });
    });
});

//* *************** CREATE NEW CALENDAR **********************//
exports.createNewCalendar = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const OAuthToken = request.body.OAuthToken;

  googleClient.authorize(OAuthToken, createCalendar);
  function createCalendar(auth) {
    const calendarCreate = Promise.promisify(google.calendar('v3').calendars.insert);
    const config = {
      auth,
      resource: { summary: 'Wheres My Money!!!' },
    };
    calendarCreate(config)
      .then(calendar => response.json(calendar))
      .catch(e => response.end(`there was an error contacting Google Calendar ${e}`));
  }
});

//* ************* EXCHANGE PUBLIC TOKEN ******************//
exports.exchangePublicToken = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const publicToken = request.body.publicToken;
  const uniqueUserId = request.body.uniqueUserId;

  plaidClient.exchangePublicToken(publicToken)
    .then((successResponse) => {
      const payload = {
        itemId: successResponse.item_id,
        access_token: successResponse.access_token,
        request_id: successResponse.request_id,
      };
      admin.database()
        .ref(`/users/${uniqueUserId}/items/${payload.itemId}`)
        .set(payload.itemId);
      admin.database()
        .ref(`/items/${payload.itemId}`)
        .set({ access_token: payload.access_token, uniqueUserId });
    }).then(response.end())
    .catch(error => console.log(error));
});

exports.plaidWebHook = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const itemId = request.body.item_id;
  const ref = admin.database().ref(`items/${itemId}`);
  ref.once('value')
    .then(snapshot => ({
      url: 'http://localhost:5000/testproject-6177f/us-central1/getTransactionsFromPlaid',
      payload: {
        access_token: snapshot.val().access_token,
        uniqueUserId: snapshot.val().uniqueUserId,
      },
    })).then((config) => {
      axios.post(config.url, config.payload)
        .then(() => {
          axios.post('http://localhost:5000/testproject-6177f/us-central1/addCalendarEvents', config.payload)
            .then(response.end());
        });
    });
});

//* ************** GET TRANSACTIONS FROM PLAID ***********************//
exports.getTransactionsFromPlaid = functions.https.onRequest((request, response) => {
  const access_token = request.body.access_token;
  const uniqueUserId = request.body.uniqueUserId;
  const now = moment();
  const today = now.format('YYYY-MM-DD');
  const thirtyDaysAgo = now.subtract(1000, 'days').format('YYYY-MM-DD');

  plaidClient.getTransactions(access_token, thirtyDaysAgo, today)
    .then((successResponse) => {
      const item_id = successResponse.item.item_id;
      const institution_id = successResponse.item.institution_id;
      const accounts = successResponse.accounts;
      const request_id = successResponse.request_id;
      const transactions = successResponse.transactions;

      plaidClient.getInstitutionById(institution_id)
        .then(result => result.institution.name)
        .then((institution_name) => {
          admin.database()
            .ref(`items/${item_id}/`)
            .update({
              transactions,
              institutionName: institution_name,
              institutionId: institution_id })
            .then(() => {
              accounts.forEach((account) => {
                admin.database().ref(`/accounts/${account.account_id}`).update(account);
              });
            })
            .then(response.end());
        });
    });
});

//* *************** ADD CALENDAR EVENTS **********************//
exports.addCalendarEvents = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const uniqueUserId = request.body.uniqueUserId;
  let calendarId;
  let OAuthToken;

  admin.database()
    .ref(`users/${uniqueUserId}`)
    .once('value').then((snapshot) => {
      calendarId = snapshot.val().calendarId;
      OAuthToken = snapshot.val().OAuthToken;
    })
    .then(() => {
      googleClient.authorize(OAuthToken, createEvents);
    });

  function createEvents(auth) {
    const config = {
      url: 'http://localhost:5000/testproject-6177f/us-central1/getDailySpendingAndTransactions',
      payload: { uniqueUserId },
    };
    axios.post(config.url, config.payload)
      .then((transactionsByDate) => {
        const dailySpending = transactionsByDate.data;

        for (const date in dailySpending) {
          const sum = Math.round(dailySpending[date].sum);
          const list = dailySpending[date].list.join('\n');
          const event = {
            summary: `Spent $${sum}`,
            location: 'See description for transaction details!',
            description: `Transactions: \n\  ${list}`,
            start: {
              date,
              timeZone: 'America/Los_Angeles',
            },
            end: {
              date,
              timeZone: 'America/Los_Angeles',
            },
          };

          const targetCal = {
            auth,
            calendarId,
            resource: event,
          };

          const eventInsert = Promise.promisify(google.calendar('v3').events.insert);

          eventInsert(targetCal)
            .catch(e => response.end(`there was an error contacting Google Calendar${e}`));
        }
      }).then(response.end(''))
      .catch(e => console.log(e));
  }
});

exports.getDailySpendingAndTransactions = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const uniqueUserId = request.body.uniqueUserId;
  const config = {
    url: 'http://localhost:5000/testproject-6177f/us-central1/getTransactionsFromDatabase',
    payload: {
      uniqueUserId,
    },
  };

  axios.post(config.url, config.payload)
    .then((transactions) => {
      const transactionsByDate = {};
      transactions.data.forEach((transaction) => {
        transactionsByDate[transaction.date] = transactionsByDate[transaction.date] || { list: [], sum: 0 };
        transactionsByDate[transaction.date].list.push(`${transaction.name}: $${transaction.amount}`);
        transactionsByDate[transaction.date].sum += transaction.amount;
      });
      return transactionsByDate;
    }).then(transactionsByDate => response.json(transactionsByDate))
    .catch(error => console.log(error));
});

exports.getTransactionsFromDatabase = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const uniqueUserId = request.body.uniqueUserId;
  let allTransactions = [];
  admin.database()
    .ref('items/')
    .once('value')
    .then((snapshot) => {
      snapshot.forEach((childSnapshot) => {
        if (childSnapshot.val().uniqueUserId === uniqueUserId) {
          allTransactions = allTransactions.concat(childSnapshot.val().transactions);
        }
      });
    })
    .then(() => {
      response.json(allTransactions);
    });
});

exports.deleteUserProfile = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const uniqueUserId = request.body.uniqueUserId;
  const itemsRef = admin.database().ref(`users/${uniqueUserId}/items`);
  itemsRef.once('value')
    .then((snapshot) => {
      snapshot.forEach((childSnapshot) => {
        admin.database()
          .ref(`items/${childSnapshot.val()}/`)
          .once('value')
          .then((snap) => {
            const config = {
              url: 'http://localhost:5000/testproject-6177f/us-central1/deleteItem',
              payload: {
                access_token: snap.val().access_token,
              },
            };
            axios.post(config.url, config.payload);
          })
          .then(() => admin.database().ref(`items/${childSnapshot.val()}`).remove());
      });
    }).then(() => {
      const ref = admin.database().ref(`users/${uniqueUserId}/`);
      ref.once('value')
        .then((snapshot) => {
          const config = {
            url: 'http://localhost:5000/testproject-6177f/us-central1/deleteCalendar',
            payload: {
              calendarId: snapshot.val().calendarId,
              OAuthToken: snapshot.val().OAuthToken,
            },
          };
          axios.post(config.url, config.payload)
            .then(admin.database().ref(`users/${uniqueUserId}`).remove())
            .then(response.end('Profile Deleted'));
        });
    }).catch(e => console.log(e));
});

exports.deleteItem = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const access_token = request.body.access_token;
  plaidClient.deleteItem(access_token)
    .then((result) => {
      response.end('Bank Item Deleted', result);
    });
});

exports.deleteCalendar = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const OAuthToken = request.body.OAuthToken;
  const calendarId = request.body.calendarId;

  googleClient.authorize(OAuthToken, deleteCalendar);

  function deleteCalendar(auth) {
    const calendarDelete = Promise.promisify(google.calendar('v3').calendars.delete);
    const config = {
      auth,
      calendarId,
    };
    calendarDelete(config)
      .then((calendar) => {
        response.json(calendar);
      }).catch(e => response.end(`there was an error contacting Google Calendar ${e}`));
  }
});

exports.getAllUserInstitutions = functions.https.onRequest((request, response) => {
  response.header('Access-Control-Allow-Origin', '*');
  const uniqueUserId = request.body.uniqueUserId;
  const allInstitutions = {};
  let counter = 0;
  let total;

  admin.database()
    .ref(`users/${uniqueUserId}/items`)
    .once('value')
    .then((snapshot) => {
      total = Object.keys(snapshot.val()).length;
      snapshot.forEach((childSnap) => {
        admin.database()
          .ref(`items/${childSnap.key}/institutionName`)
          .once('value')
          .then((snap) => {
            const institution = snap.val();
            allInstitutions[institution] = true;
            counter++;
            if (counter === total) { response.json(allInstitutions); }
          });
      });
    });
});
