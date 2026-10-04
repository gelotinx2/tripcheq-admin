// Decode an encoded polyline into [lng, lat] pairs
export function decodePolyline(str, precision = 5) {
  let index = 0,
    lat = 0,
    lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);
  while (index < str.length) {
    let byte,
      shift = 0,
      result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = result = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}

// Encode [lng, lat] pairs into a polyline string
export function encodePolyline(coordinates, precision = 5) {
  const factor = Math.pow(10, precision);
  let result = "";
  let lastLat = 0,
    lastLng = 0;

  const encodeValue = (value) => {
    value = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (value >= 0x20) {
      chunk += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    chunk += String.fromCharCode(value + 63);
    return chunk;
  };

  for (const [lng, lat] of coordinates) {
    const latE5 = Math.round(lat * factor);
    const lngE5 = Math.round(lng * factor);
    result += encodeValue(latE5 - lastLat) + encodeValue(lngE5 - lastLng);
    lastLat = latE5;
    lastLng = lngE5;
  }
  return result;
}
