<?php
  $data = file_get_contents('php://input', false, null, 0, 10000);
  $ch = curl_init('localhost:3001');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
  curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
  curl_setopt($ch, CURLOPT_HEADER, true);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  $ret = curl_exec($ch);
  if($ret === false) {
    http_response_code(503);
    header('Content-type: text/plain');
    echo 'Curl error: ' . curl_error($ch);
  } else {
    list($header, $contents) = explode("\r\n\r\n", $ret, 2);
    http_response_code(curl_getinfo($ch, CURLINFO_HTTP_CODE));
    curl_close($ch);
    header('Content-type: application/json');
    print $contents;
  }
?>
