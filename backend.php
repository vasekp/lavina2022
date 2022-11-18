<?PHP
$ch = curl_init('147.32.5.254:3000');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $_POST);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
list($header, $contents) = preg_split('/([\r\n][\r\n])\\1/', curl_exec($ch), 2);
$status = curl_getinfo($ch);
curl_close($ch);
$header_text = preg_split('/[\r\n]+/', $header);
header('Content-type: application/json');
print $contents;
?>
