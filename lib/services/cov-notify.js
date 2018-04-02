'use strict';

const baAsn1      = require('../asn1');
const baEnum      = require('../enum');

module.exports.encode = (buffer, subscriberProcessId, initiatingDeviceId, monitoredObjectId, timeRemaining, values) => {
  baAsn1.encodeContextUnsigned(buffer, 0, subscriberProcessId);
  baAsn1.encodeContextObjectId(buffer, 1, baEnum.ObjectTypes.OBJECT_DEVICE, initiatingDeviceId);
  baAsn1.encodeContextObjectId(buffer, 2, monitoredObjectId.type, monitoredObjectId.instance);
  baAsn1.encodeContextUnsigned(buffer, 3, timeRemaining);
  baAsn1.encodeOpeningTag(buffer, 4);
  values.forEach((value) => {
    baAsn1.encodeContextEnumerated(buffer, 0, value.property.id);
    if (value.property.index === baAsn1.BACNET_ARRAY_ALL) {
      baAsn1.encodeContextUnsigned(buffer, 1, value.property.index);
    }
    baAsn1.encodeOpeningTag(buffer, 2);
    value.value.forEach((v) => {
      baAsn1.bacappEncodeApplicationData(buffer, v);
    });
    baAsn1.encodeClosingTag(buffer, 2);
    if (value.priority === baAsn1.BACNET_NO_PRIORITY) {
      baAsn1.encodeContextUnsigned(buffer, 3, value.priority);
    }
    // TODO: Handle to too large telegrams -> ADPU limit
  });
  baAsn1.encodeClosingTag(buffer, 4);
};

module.exports.decode = (buffer, offset, apduLen) => {
  let len = 0;
  let result;
  let decodedValue;
  if (!baAsn1.decodeIsContextTag(buffer, offset + len, 0)) return;
  result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  decodedValue = baAsn1.decodeUnsigned(buffer, offset + len, result.value);
  len += decodedValue.len;
  const subscriberProcessId = decodedValue.value;
  if (!baAsn1.decodeIsContextTag(buffer, offset + len, 1)) return;
  result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  decodedValue = baAsn1.decodeObjectId(buffer, offset + len);
  len += decodedValue.len;
  const initiatingDeviceId = {type: decodedValue.objectType, instance: decodedValue.instance};
  if (!baAsn1.decodeIsContextTag(buffer, offset + len, 2)) return;
  result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  decodedValue = baAsn1.decodeObjectId(buffer, offset + len);
  len += decodedValue.len;
  const monitoredObjectId = {type: decodedValue.objectType, instance: decodedValue.instance};
  if (!baAsn1.decodeIsContextTag(buffer, offset + len, 3)) return;
  result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
  len += result.len;
  decodedValue = baAsn1.decodeUnsigned(buffer, offset + len, result.value);
  len += decodedValue.len;
  const timeRemaining = decodedValue.value;
  if (!baAsn1.decodeIsOpeningTagNumber(buffer, offset + len, 4)) return;
  len++;
  const values = [];
  while ((apduLen - len) > 1 && !baAsn1.decodeIsClosingTagNumber(buffer, offset + len, 4)) {
    let newEntry = {};
    newEntry.property = {};
    if (!baAsn1.decodeIsContextTag(buffer, offset + len, 0)) return;
    result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
    len += result.len;
    decodedValue = baAsn1.decodeEnumerated(buffer, offset + len, result.value);
    len += decodedValue.len;
    newEntry.property.id = decodedValue.value;
    if (baAsn1.decodeIsContextTag(buffer, offset + len, 1)) {
      result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
      len += result.len;
      decodedValue = baAsn1.decodeUnsigned(buffer, offset + len, result.value);
      len += decodedValue.len;
      newEntry.property.index = decodedValue.value;
    } else {
      newEntry.property.index = baAsn1.BACNET_ARRAY_ALL;
    }
    if (!baAsn1.decodeIsOpeningTagNumber(buffer, offset + len, 2)) return;
    len++;
    const properties = [];
    while ((apduLen - len) > 1 && !baAsn1.decodeIsClosingTagNumber(buffer, offset + len, 2)) {
      decodedValue = baAsn1.bacappDecodeApplicationData(buffer, offset + len, apduLen + offset, monitoredObjectId.type, newEntry.property.id);
      if (!decodedValue) return;
      len += decodedValue.len;
      delete decodedValue.len;
      properties.push(decodedValue);
    }
    newEntry.value = properties;
    len++;
    if (baAsn1.decodeIsContextTag(buffer, offset + len, 3)) {
      result = baAsn1.decodeTagNumberAndValue(buffer, offset + len);
      len += result.len;
      decodedValue = baAsn1.decodeUnsigned(buffer, offset + len, result.value);
      len += decodedValue.len;
      newEntry.priority = decodedValue.value;
    } else {
      newEntry.priority = baAsn1.BACNET_NO_PRIORITY;
    }
    values.push(newEntry);
  }
  return {
    len: len,
    subscriberProcessId: subscriberProcessId,
    initiatingDeviceId: initiatingDeviceId,
    monitoredObjectId: monitoredObjectId,
    timeRemaining: timeRemaining,
    values: values
  };
};