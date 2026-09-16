import json
import urllib.request
import sys

def run_tests():
    # Login as admin
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/auth/login', 
        data=json.dumps({'email': 'admin@ladris.gov.in', 'password': 'admin123'}).encode(), 
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req, timeout=5)
    token = json.loads(res.read().decode())['access_token']
    h = {'Authorization': f'Bearer {token}'}

    endpoints = [
        ('GET', '/api/v1/analytics/executive'),
        ('GET', '/api/v1/projects/?page_size=100'),
        ('GET', '/api/v1/intelligence/gis-heatmap'),
        ('GET', '/api/v1/intelligence/priority-queue'),
        ('GET', '/api/v1/alerts/'),
        ('GET', '/api/ml/model-info'),
    ]

    print("=== Testing Core Endpoints ===", flush=True)
    project_id = None
    for method, path in endpoints:
        r = urllib.request.Request(f'http://localhost:8000{path}', headers=h)
        try:
            resp = urllib.request.urlopen(r, timeout=5)
            data = json.loads(resp.read().decode())
            status = resp.status
            extra = ""
            if 'projects' in path and isinstance(data, dict):
                items = data.get('items', [])
                extra = f"-> {len(items)} items, total: {data.get('total')}"
                if items:
                    project_id = items[0]['id']
            elif 'gis' in path:
                extra = f"-> {data.get('total_locations')} locations"
            elif 'executive' in path:
                extra = f"-> active: {data.get('executive_kpis', {}).get('total_active_projects')}"
            elif 'model-info' in path:
                extra = f"-> version: {data.get('model_version')}"
            print(f"[{status}] {method} {path} {extra}", flush=True)
        except Exception as e:
            print(f"[FAIL] {method} {path}: {e}", flush=True)

    if project_id:
        print(f"\n=== Testing ML Endpoints for Project {project_id} ===", flush=True)
        ml_endpoints = [
            ('GET', f'/api/ml/prediction/{project_id}'),
            ('GET', f'/api/ml/explanation/{project_id}'),
            ('GET', f'/api/ml/stages/{project_id}'),
        ]
        for method, path in ml_endpoints:
            r = urllib.request.Request(f'http://localhost:8000{path}', headers=h)
            try:
                resp = urllib.request.urlopen(r, timeout=5)
                data = json.loads(resp.read().decode())
                print(f"[{resp.status}] {method} {path} -> OK (keys: {list(data.keys())[:3]})", flush=True)
            except Exception as e:
                print(f"[FAIL] {method} {path}: {e}", flush=True)

    # Test all 5 stakeholder logins and their project visibility
    print("\n=== Testing Role Scoping across Stakeholders ===", flush=True)
    roles = [
        ('Super Admin', 'admin@ladris.gov.in', 'admin123'),
        ('District Officer', 'district@ladris.gov.in', 'Password123!'),
        ('State Admin', 'state@ladris.gov.in', 'Password123!'),
        ('Project Agency', 'agency@ladris.gov.in', 'Password123!'),
        ('LA Officer', 'authority@ladris.gov.in', 'Password123!'),
        ('MoRTH Central', 'central@ladris.gov.in', 'Password123!'),
        ('Policy Analyst', 'policy@ladris.gov.in', 'Password123!'),
    ]
    for role_name, email, pwd in roles:
        try:
            req_login = urllib.request.Request(
                'http://localhost:8000/api/v1/auth/login', 
                data=json.dumps({'email': email, 'password': pwd}).encode(), 
                headers={'Content-Type': 'application/json'}
            )
            res_login = urllib.request.urlopen(req_login, timeout=5)
            user_token = json.loads(res_login.read().decode())['access_token']
            user_h = {'Authorization': f'Bearer {user_token}'}
            
            # Projects count
            r_p = urllib.request.Request('http://localhost:8000/api/v1/projects/?page_size=100', headers=user_h)
            p_data = json.loads(urllib.request.urlopen(r_p, timeout=5).read().decode())
            total = p_data.get('total')
            
            # Dashboard count
            r_d = urllib.request.Request('http://localhost:8000/api/v1/analytics/executive', headers=user_h)
            d_data = json.loads(urllib.request.urlopen(r_d, timeout=5).read().decode())
            dash_count = d_data.get('executive_kpis', {}).get('total_active_projects')
            
            print(f"Role: {role_name:18} | Email: {email:28} | Projects: {total:2} | Dashboard: {dash_count:2}", flush=True)
        except Exception as e:
            print(f"Role: {role_name:18} | Email: {email:28} | FAILED: {e}", flush=True)

if __name__ == '__main__':
    run_tests()
