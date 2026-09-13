import urllib.request
import urllib.error
import json

def main():
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/auth/login',
        data=json.dumps({'email':'admin@ladris.gov.in', 'password':'admin123'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )

    try:
        res = urllib.request.urlopen(req)
        print(res.read().decode())
    except urllib.error.HTTPError as e:
        print("HTTP ERROR:", e.code)
        print("RESPONSE BODY:")
        print(e.read().decode())
    except Exception as e:
        print("OTHER ERROR:", e)

if __name__ == "__main__":
    main()
