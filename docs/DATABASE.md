<table>
<tr>
<td><img src="images/firebase.png" width="154px" height="43px" alt="Firebase"/></td>
<td>Database</td>
</tr>
</table>

## Enabling the database features
Since this is the most likely feature you'll use with this plugin it has already been properly configured to interact with the database, so nothing to do here on top of the stuff in the main readme.

## Functions

### init
You can optionally pass `persist` to the [`init` function](../README.md#init) to make Firebase save data to the local disc so it will work in offline scenario's. Default `false`.

```js
  firebase.init({
    persist: true
  });
```

### setValue
Data is stored as JSON data at a specific path (which is appended to the URL you passed to `init`).
If you want to add data to a known path use this, otherwise use `push` (see below).

The plugin will take care of serializing JSON data to native data structures.

```js

  // to store a JSON object
  firebase.setValue(
      '/companies',
      {'foo':'bar'}
  );

  // to store an array of JSON objects
  firebase.setValue(
      '/companies',
      [
        {name: 'Telerik', country: 'Bulgaria'},
        {name: 'Google', country: 'USA'}
      ]
  );
```

### push
This function will store a JSON object at path `<Firebase URL>/users/<Generated Key>`

```js
  firebase.push(
      '/users',
      {
        'first': 'Eddy',
        'last': 'Verbruggen',
        'birthYear': 1977,
        'isMale': true,
        'address': {
          'street': 'foostreet',
          'number': 123
        }
      }
  ).then(
      function (result) {
        console.log("created key: " + result.key);
      }
  );
```

### query
Firebase supports querying data and this plugin does too, since v2.0.0.

Let's say we have the structure as defined at `setValue`, then use this query to retrieve the companies in country 'Bulgaria':

```js
    var onQueryEvent = function(result) {
        // note that the query returns 1 match at a time
        // in the order specified in the query
        if (!result.error) {
            console.log("Event type: " + result.type);
            console.log("Key: " + result.key);
            console.log("Value: " + JSON.stringify(result.value));
        }
    };

    firebase.query(
        onQueryEvent,
        "/companies",
        {
            // set this to true if you want to check if the value exists or just want the event to fire once
            // default false, so it listens continuously
            singleEvent: true,
            // order by company.country
            orderBy: {
                type: firebase.QueryOrderByType.CHILD,
                value: 'country' // mandatory when type is 'child'
            },
            // but only companies named 'Telerik'
            // (this range relates to the orderBy clause)
            range: {
                type: firebase.QueryRangeType.EQUAL_TO,
                value: 'Bulgaria'
            },
            // only the first 2 matches
            // (note that there's only 1 in this case anyway)
            limit: {
                type: firebase.QueryLimitType.LAST,
                value: 2
            }
        }
    );
```

For supported values of the orderBy/range/limit's `type` properties, take a look at the [`firebase-common.d.ts`](firebase-common.d.ts) TypeScript definitions in this repo.

### update
Changes the values of the keys specified in the dictionary without overwriting other keys at this location.

```js
  firebase.update(
      '/companies',
      {'foo':'baz'}
  );
```

### addChildEventListener
To listen for changes in your database you can pass in a listener callback function.
You get to control which path inside you database you want to listen to, by default it's `/` which is the entire database.

The plugin will take care of serializing native data structures to JSON data.

```js
  var onChildEvent = function(result) {
    console.log("Event type: " + result.type);
    console.log("Key: " + result.key);
    console.log("Value: " + JSON.stringify(result.value));
  };

  // listen to changes in the /users path
  firebase.addChildEventListener(onChildEvent, "/users");
```

### addValueEventListener
The difference with `addChildEventListener` is [explained here](https://www.firebase.com/docs/ios/guide/retrieving-data.html).
The link is for the iOS SDK, but it's the same for Android.

```js
  var onValueEvent = function(result) {
    console.log("Event type: " + result.type);
    console.log("Key: " + result.key);
    console.log("Value: " + JSON.stringify(result.value));
  };

  // listen to changes in the /companies path
  firebase.addValueEventListener(onValueEvent, "/companies");
```

### remove
You can remove the entire database content by passing `/` as param,
but if you only want to wipe everything at `/users`, do this:

```js
  firebase.remove("/users");
```