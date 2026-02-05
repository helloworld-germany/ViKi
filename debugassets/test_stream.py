import urllib.request
import time

url = 'http://localhost:7071/api/consultVoiceListen?id=0-0'
print(f'Connecting to {url}...')

try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        print(f'Status: {response.getcode()}')
        start = time.time()
        while True:
            line = response.readline()
            if not line:
                break
            print(f'Received: {len(line)} bytes')
            if time.time() - start > 10:
                print('10 seconds elapsed, stopping.')
                break
except Exception as e:
    print(f'Error: {e}')
