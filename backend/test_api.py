import urllib.request
import urllib.error
import json

def main():
    # 1. Login to get token
    req1 = urllib.request.Request(
        'http://localhost:8000/api/v1/auth/login',
        data=json.dumps({'email':'admin@ladris.gov.in', 'password':'admin123'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        res1 = urllib.request.urlopen(req1)
        token_data = json.loads(res1.read().decode())
        token = token_data['access_token']
    except Exception as e:
        print("Login failed (ensure uvicorn server is running on port 8000):", e)
        return

    # 2. Fetch projects
    req2 = urllib.request.Request(
        'http://localhost:8000/api/v1/projects/',
        headers={'Authorization': f'Bearer {token}'}
    )
    try:
        res2 = urllib.request.urlopen(req2)
        projects_data = json.loads(res2.read().decode())
        print("Projects returned:", projects_data.get('total'))
    except urllib.error.HTTPError as e:
        print("HTTP ERROR:", e.code)
        print("RESPONSE:", e.read().decode())
    except Exception as e:
        print("ERROR:", e)

    # 3. Fetch data sources
    req3 = urllib.request.Request(
        'http://localhost:8000/api/v1/data-sources/',
        headers={'Authorization': f'Bearer {token}'}
    )
    try:
        res3 = urllib.request.urlopen(req3)
        ds_data = json.loads(res3.read().decode())
        print("Data sources returned:", ds_data.get('total'))
    except urllib.error.HTTPError as e:
        print("DS HTTP ERROR:", e.code)
        print("DS RESPONSE:", e.read().decode())
    except Exception as e:
        print("DS ERROR:", e)

if __name__ == "__main__":
    main()
