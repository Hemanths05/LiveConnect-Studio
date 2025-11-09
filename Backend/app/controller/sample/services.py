from flask import request
from app.utils.middleware.response_format import resp_success, resp_failure

#singleton class
class Service:
    instance = None
    def __init__(self):
        if Service.instance is None:
            Service.instance = self
        else:
            raise Exception("Only once created an object you can go with that instance")

    @staticmethod
    def get_instance():
        if Service.instance is None:
            Service.instance = Service()
        return Service.instance

    def sample_create(self, request):
        try:
            print("Sample Create API executed successfully")
            email = request.json.get('email')
            print(email, request.json)
            # Add your logic here
            return resp_success('Record added successfully', {'email': email})
        except Exception as e:
            print(f"Error in sample_create: {str(e)}")
            return resp_failure('Failed to add record', str(e))

    def sample_get(self, request):
        try:
            print("Sample Get API executed successfully")
            # Add your logic here
            sample_data = {'sample_data': 'This is sample data'}
            return resp_success('Fetch details successfully', sample_data)
        except Exception as e:
            print(f"Error in sample_get: {str(e)}")
            return resp_failure('Failed to fetch details', str(e))