<?php
  $data = file_get_contents('php://input', false, null, 0, 10000);
  $ch = curl_init('localhost:3000');
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: text/plain'));
  curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
  curl_setopt($ch, CURLOPT_HEADER, true);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  list($header, $contents) = preg_split('/([\r\n][\r\n])\\1/', curl_exec($ch), 2);
  if(curl_errno($ch)) {
    header('Content-type: text/plain');
    echo 'Curl error: ' . curl_error($ch);
  } else {
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if($status !== 200)
      http_response_code($status);
    else {
      header('Content-type: application/json');
      print $contents;
    }
  }
?>
