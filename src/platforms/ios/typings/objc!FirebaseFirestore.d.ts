
declare class FIRCollectionReference extends FIRQuery {

	static alloc(): FIRCollectionReference; // inherited from NSObject

	static new(): FIRCollectionReference; // inherited from NSObject

	readonly collectionID: string;

	readonly parent: FIRDocumentReference;

	readonly path: string;

	addDocumentWithData(data: NSDictionary<string, any>): FIRDocumentReference;

	addDocumentWithDataCompletion(data: NSDictionary<string, any>, completion: (p1: NSError) => void): FIRDocumentReference;

	documentWithAutoID(): FIRDocumentReference;

	documentWithPath(documentPath: string): FIRDocumentReference;
}

declare class FIRDocumentChange extends NSObject {

	static alloc(): FIRDocumentChange; // inherited from NSObject

	static new(): FIRDocumentChange; // inherited from NSObject

	readonly document: FIRQueryDocumentSnapshot;

	readonly newIndex: number;

	readonly oldIndex: number;

	readonly type: FIRDocumentChangeType;
}

declare const enum FIRDocumentChangeType {

	Added = 0,

	Modified = 1,

	Removed = 2
}

declare class FIRDocumentReference extends NSObject {

	static alloc(): FIRDocumentReference; // inherited from NSObject

	static new(): FIRDocumentReference; // inherited from NSObject

	readonly documentID: string;

	readonly firestore: FIRFirestore;

	readonly parent: FIRCollectionReference;

	readonly path: string;

	addSnapshotListener(listener: (p1: FIRDocumentSnapshot, p2: NSError) => void): FIRListenerRegistration;

	addSnapshotListenerWithIncludeMetadataChangesListener(includeMetadataChanges: boolean, listener: (p1: FIRDocumentSnapshot, p2: NSError) => void): FIRListenerRegistration;

	collectionWithPath(collectionPath: string): FIRCollectionReference;

	deleteDocument(): void;

	deleteDocumentWithCompletion(completion: (p1: NSError) => void): void;

	getDocumentWithCompletion(completion: (p1: FIRDocumentSnapshot, p2: NSError) => void): void;

	getDocumentWithSourceCompletion(source: FIRFirestoreSource, completion: (p1: FIRDocumentSnapshot, p2: NSError) => void): void;

	setData(documentData: NSDictionary<string, any>): void;

	setDataCompletion(documentData: NSDictionary<string, any>, completion: (p1: NSError) => void): void;

	setDataMerge(documentData: NSDictionary<string, any>, merge: boolean): void;

	setDataMergeCompletion(documentData: NSDictionary<string, any>, merge: boolean, completion: (p1: NSError) => void): void;

	setDataMergeFields(documentData: NSDictionary<string, any>, mergeFields: NSArray<any> | any[]): void;

	setDataMergeFieldsCompletion(documentData: NSDictionary<string, any>, mergeFields: NSArray<any> | any[], completion: (p1: NSError) => void): void;

	updateData(fields: NSDictionary<any, any>): void;

	updateDataCompletion(fields: NSDictionary<any, any>, completion: (p1: NSError) => void): void;
}

declare class FIRDocumentSnapshot extends NSObject {

	static alloc(): FIRDocumentSnapshot; // inherited from NSObject

	static new(): FIRDocumentSnapshot; // inherited from NSObject

	readonly documentID: string;

	readonly exists: boolean;

	readonly metadata: FIRSnapshotMetadata;

	readonly reference: FIRDocumentReference;

	data(): NSDictionary<string, any>;

	dataWithServerTimestampBehavior(serverTimestampBehavior: FIRServerTimestampBehavior): NSDictionary<string, any>;

	objectForKeyedSubscript(key: any): any;

	valueForField(field: any): any;

	valueForFieldServerTimestampBehavior(field: any, serverTimestampBehavior: FIRServerTimestampBehavior): any;
}

declare class FIRFieldPath extends NSObject implements NSCopying {

	static alloc(): FIRFieldPath; // inherited from NSObject

	static documentID(): FIRFieldPath;

	static new(): FIRFieldPath; // inherited from NSObject

	constructor(o: { fields: NSArray<string> | string[]; });

	copyWithZone(zone: interop.Pointer | interop.Reference<any>): any;

	initWithFields(fieldNames: NSArray<string> | string[]): this;
}

declare class FIRFieldValue extends NSObject {

	static alloc(): FIRFieldValue; // inherited from NSObject

	static fieldValueForArrayRemove(elements: NSArray<any> | any[]): FIRFieldValue;

	static fieldValueForArrayUnion(elements: NSArray<any> | any[]): FIRFieldValue;

	static fieldValueForDelete(): FIRFieldValue;

	static fieldValueForDoubleIncrement(d: number): FIRFieldValue;

	static fieldValueForIntegerIncrement(l: number): FIRFieldValue;

	static fieldValueForServerTimestamp(): FIRFieldValue;

	static new(): FIRFieldValue; // inherited from NSObject
}

declare class FIRFirestore extends NSObject {

	static alloc(): FIRFirestore; // inherited from NSObject

	static enableLogging(logging: boolean): void;

	static firestore(): FIRFirestore;

	static firestoreForApp(app: FIRApp): FIRFirestore;

	static new(): FIRFirestore; // inherited from NSObject

	readonly app: FIRApp;

	settings: FIRFirestoreSettings;

	addSnapshotsInSyncListener(listener: () => void): FIRListenerRegistration;

	batch(): FIRWriteBatch;

	clearPersistenceWithCompletion(completion: (p1: NSError) => void): void;

	collectionGroupWithID(collectionID: string): FIRQuery;

	collectionWithPath(collectionPath: string): FIRCollectionReference;

	disableNetworkWithCompletion(completion: (p1: NSError) => void): void;

	documentWithPath(documentPath: string): FIRDocumentReference;

	enableNetworkWithCompletion(completion: (p1: NSError) => void): void;

	runTransactionWithBlockCompletion(updateBlock: (p1: FIRTransaction, p2: interop.Pointer | interop.Reference<NSError>) => any, completion: (p1: any, p2: NSError) => void): void;

	terminateWithCompletion(completion: (p1: NSError) => void): void;

	waitForPendingWritesWithCompletion(completion: (p1: NSError) => void): void;
}

declare const enum FIRFirestoreErrorCode {

	OK = 0,

	Cancelled = 1,

	Unknown = 2,

	InvalidArgument = 3,

	DeadlineExceeded = 4,

	NotFound = 5,

	AlreadyExists = 6,

	PermissionDenied = 7,

	ResourceExhausted = 8,

	FailedPrecondition = 9,

	Aborted = 10,

	OutOfRange = 11,

	Unimplemented = 12,

	Internal = 13,

	Unavailable = 14,

	DataLoss = 15,

	Unauthenticated = 16
}

declare var FIRFirestoreErrorDomain: string;

declare class FIRFirestoreSettings extends NSObject implements NSCopying {

	static alloc(): FIRFirestoreSettings; // inherited from NSObject

	static new(): FIRFirestoreSettings; // inherited from NSObject

	cacheSizeBytes: number;

	dispatchQueue: NSObject;

	host: string;

	persistenceEnabled: boolean;

	sslEnabled: boolean;

	timestampsInSnapshotsEnabled: boolean;

	copyWithZone(zone: interop.Pointer | interop.Reference<any>): any;
}

declare const enum FIRFirestoreSource {

	Default = 0,

	Server = 1,

	Cache = 2
}

declare class FIRGeoPoint extends NSObject implements NSCopying {

	static alloc(): FIRGeoPoint; // inherited from NSObject

	static new(): FIRGeoPoint; // inherited from NSObject

	readonly latitude: number;

	readonly longitude: number;

	constructor(o: { latitude: number; longitude: number; });

	copyWithZone(zone: interop.Pointer | interop.Reference<any>): any;

	initWithLatitudeLongitude(latitude: number, longitude: number): this;
}

interface FIRListenerRegistration extends NSObjectProtocol {

	remove(): void;
}
declare var FIRListenerRegistration: {

	prototype: FIRListenerRegistration;
};

declare class FIRQuery extends NSObject {

	static alloc(): FIRQuery; // inherited from NSObject

	static new(): FIRQuery; // inherited from NSObject

	readonly firestore: FIRFirestore;

	addSnapshotListener(listener: (p1: FIRQuerySnapshot, p2: NSError) => void): FIRListenerRegistration;

	addSnapshotListenerWithIncludeMetadataChangesListener(includeMetadataChanges: boolean, listener: (p1: FIRQuerySnapshot, p2: NSError) => void): FIRListenerRegistration;

	isEqual(other: FIRQuery): boolean;

	getDocumentsWithCompletion(completion: (p1: FIRQuerySnapshot, p2: NSError) => void): void;

	getDocumentsWithSourceCompletion(source: FIRFirestoreSource, completion: (p1: FIRQuerySnapshot, p2: NSError) => void): void;

	queryEndingAtDocument(document: FIRDocumentSnapshot): FIRQuery;

	queryEndingAtValues(fieldValues: NSArray<any> | any[]): FIRQuery;

	queryEndingBeforeDocument(document: FIRDocumentSnapshot): FIRQuery;

	queryEndingBeforeValues(fieldValues: NSArray<any> | any[]): FIRQuery;

	queryFilteredUsingPredicate(predicate: NSPredicate): FIRQuery;

	queryLimitedTo(limit: number): FIRQuery;

	queryLimitedToLast(limit: number): FIRQuery;

	queryOrderedByField(field: string): FIRQuery;

	queryOrderedByFieldDescending(field: string, descending: boolean): FIRQuery;

	queryOrderedByFieldPath(path: FIRFieldPath): FIRQuery;

	queryOrderedByFieldPathDescending(path: FIRFieldPath, descending: boolean): FIRQuery;

	queryStartingAfterDocument(document: FIRDocumentSnapshot): FIRQuery;

	queryStartingAfterValues(fieldValues: NSArray<any> | any[]): FIRQuery;

	queryStartingAtDocument(document: FIRDocumentSnapshot): FIRQuery;

	queryStartingAtValues(fieldValues: NSArray<any> | any[]): FIRQuery;

	queryWhereFieldArrayContains(field: string, value: any): FIRQuery;

	queryWhereFieldArrayContainsAny(field: string, values: NSArray<any> | any[]): FIRQuery;

	queryWhereFieldIn(field: string, values: NSArray<any> | any[]): FIRQuery;

	queryWhereFieldIsEqualTo(field: string, value: any): FIRQuery;

	queryWhereFieldIsGreaterThan(field: string, value: any): FIRQuery;

	queryWhereFieldIsGreaterThanOrEqualTo(field: string, value: any): FIRQuery;

	queryWhereFieldIsLessThan(field: string, value: any): FIRQuery;

	queryWhereFieldIsLessThanOrEqualTo(field: string, value: any): FIRQuery;

	queryWhereFieldIsNotEqualTo(field: string, value: any): FIRQuery;

	queryWhereFieldNotIn(field: string, values: NSArray<any> | any[]): FIRQuery;

	queryWhereFieldPathArrayContains(path: FIRFieldPath, value: any): FIRQuery;

	queryWhereFieldPathArrayContainsAny(path: FIRFieldPath, values: NSArray<any> | any[]): FIRQuery;

	queryWhereFieldPathIn(path: FIRFieldPath, values: NSArray<any> | any[]): FIRQuery;

	queryWhereFieldPathIsEqualTo(path: FIRFieldPath, value: any): FIRQuery;

	queryWhereFieldPathIsGreaterThan(path: FIRFieldPath, value: any): FIRQuery;

	queryWhereFieldPathIsGreaterThanOrEqualTo(path: FIRFieldPath, value: any): FIRQuery;

	queryWhereFieldPathIsLessThan(path: FIRFieldPath, value: any): FIRQuery;

	queryWhereFieldPathIsLessThanOrEqualTo(path: FIRFieldPath, value: any): FIRQuery;

	queryWhereFieldPathIsNotEqualTo(path: FIRFieldPath, value: any): FIRQuery;

	queryWhereFieldPathNotIn(path: FIRFieldPath, values: NSArray<any> | any[]): FIRQuery;
}

declare class FIRQueryDocumentSnapshot extends FIRDocumentSnapshot {

	static alloc(): FIRQueryDocumentSnapshot; // inherited from NSObject

	static new(): FIRQueryDocumentSnapshot; // inherited from NSObject
}

declare class FIRQuerySnapshot extends NSObject {

	static alloc(): FIRQuerySnapshot; // inherited from NSObject

	static new(): FIRQuerySnapshot; // inherited from NSObject

	readonly count: number;

	readonly documentChanges: NSArray<FIRDocumentChange>;

	readonly documents: NSArray<FIRQueryDocumentSnapshot>;

	readonly empty: boolean;

	readonly metadata: FIRSnapshotMetadata;

	readonly query: FIRQuery;

	documentChangesWithIncludeMetadataChanges(includeMetadataChanges: boolean): NSArray<FIRDocumentChange>;
}

declare const enum FIRServerTimestampBehavior {

	None = 0,

	Estimate = 1,

	Previous = 2
}

declare class FIRSnapshotMetadata extends NSObject {

	static alloc(): FIRSnapshotMetadata; // inherited from NSObject

	static new(): FIRSnapshotMetadata; // inherited from NSObject

	readonly fromCache: boolean;

	readonly pendingWrites: boolean;
}

declare class FIRTimestamp extends NSObject implements NSCopying {

	static alloc(): FIRTimestamp; // inherited from NSObject

	static new(): FIRTimestamp; // inherited from NSObject

	static timestamp(): FIRTimestamp;

	static timestampWithDate(date: Date): FIRTimestamp;

	static timestampWithSecondsNanoseconds(seconds: number, nanoseconds: number): FIRTimestamp;

	readonly nanoseconds: number;

	readonly seconds: number;

	constructor(o: { seconds: number; nanoseconds: number; });

	compare(other: FIRTimestamp): NSComparisonResult;

	copyWithZone(zone: interop.Pointer | interop.Reference<any>): any;

	dateValue(): Date;

	initWithSecondsNanoseconds(seconds: number, nanoseconds: number): this;
}

declare class FIRTransaction extends NSObject {

	static alloc(): FIRTransaction; // inherited from NSObject

	static new(): FIRTransaction; // inherited from NSObject

	deleteDocument(document: FIRDocumentReference): FIRTransaction;

	getDocumentError(document: FIRDocumentReference): FIRDocumentSnapshot;

	setDataForDocument(data: NSDictionary<string, any>, document: FIRDocumentReference): FIRTransaction;

	setDataForDocumentMerge(data: NSDictionary<string, any>, document: FIRDocumentReference, merge: boolean): FIRTransaction;

	setDataForDocumentMergeFields(data: NSDictionary<string, any>, document: FIRDocumentReference, mergeFields: NSArray<any> | any[]): FIRTransaction;

	updateDataForDocument(fields: NSDictionary<any, any>, document: FIRDocumentReference): FIRTransaction;
}

declare class FIRWriteBatch extends NSObject {

	static alloc(): FIRWriteBatch; // inherited from NSObject

	static new(): FIRWriteBatch; // inherited from NSObject

	commit(): void;

	commitWithCompletion(completion: (p1: NSError) => void): void;

	deleteDocument(document: FIRDocumentReference): FIRWriteBatch;

	setDataForDocument(data: NSDictionary<string, any>, document: FIRDocumentReference): FIRWriteBatch;

	setDataForDocumentMerge(data: NSDictionary<string, any>, document: FIRDocumentReference, merge: boolean): FIRWriteBatch;

	setDataForDocumentMergeFields(data: NSDictionary<string, any>, document: FIRDocumentReference, mergeFields: NSArray<any> | any[]): FIRWriteBatch;

	updateDataForDocument(fields: NSDictionary<any, any>, document: FIRDocumentReference): FIRWriteBatch;
}

declare var FirebaseFirestoreVersionNumber: number;

declare var FirebaseFirestoreVersionString: interop.Reference<number>;

declare var kFIRFirestoreCacheSizeUnlimited: number;
