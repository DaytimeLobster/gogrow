"""
This script runs the gogrow_app application using a Waitress server.
"""

from os import environ
from gogrow_app import app
import logging
from logging.handlers import RotatingFileHandler
import os
import sys
import psutil
import webbrowser
import time
import datetime
import ipaddress
import requests
from threading import Timer
from waitress import serve as waitress_serve
from colorama import init as colorama_init, Fore, Style, Back
from threading import Thread

# Initialize colorama
colorama_init(autoreset=True)

# Set up logging
class PreventDuplicatesFilter(logging.Filter):
    def __init__(self):
        super().__init__()
        self.logged_records = set()

    def filter(self, record):
        log_tuple = (record.msg, record.args)
        if log_tuple in self.logged_records:
            return False
        self.logged_records.add(log_tuple)
        return True

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

# Console handler for INFO level and above
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)
console_handler.addFilter(PreventDuplicatesFilter())

# File handler for DEBUG level and above
file_handler = RotatingFileHandler('gogrow_debug.log', maxBytes=2*1024*1024, backupCount=10)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)
file_handler.addFilter(PreventDuplicatesFilter())

logger.addHandler(console_handler)
logger.addHandler(file_handler)

def log_system_metrics(interval, start_time):
    while True:
        try:
            process = psutil.Process(os.getpid())

            # Memory
            mem_info = process.memory_info()
            memory_usage = mem_info.rss  # resident set size

            # Convert memory usage from bytes to MB and GB
            memory_usage_mb = memory_usage / (1024 ** 2)
            memory_usage_gb = memory_usage / (1024 ** 3)

            total_memory = psutil.virtual_memory().total
            total_memory_gb = total_memory / (1024 ** 3)

            # CPU
            cpu_percent = psutil.cpu_percent(interval=None)

            # Disk
            disk_usage = psutil.disk_usage('/')
            total_disk_gb = disk_usage.total / (1024 ** 3)
            used_disk_gb = disk_usage.used / (1024 ** 3)
            
            # Uptime
            uptime_seconds_total = (datetime.datetime.now() - start_time).total_seconds()

            uptime_hours = int(uptime_seconds_total // 3600)
            uptime_minutes = int((uptime_seconds_total % 3600) // 60)
            uptime_seconds = int(uptime_seconds_total % 60)

            # Health check
            response = requests.get('http://localhost:5555/health')
            health_check_status = response.json().get('status', 'unknown')
            
            logger.info(f"Memory usage: {memory_usage_mb} MB ({memory_usage_gb:.2f} GB) / Total memory: {total_memory_gb:.2f} GB")
            logger.info(f"CPU utilization: {cpu_percent}%")
            logger.info(f"Disk usage: {disk_usage.percent}% - Used: {used_disk_gb:.2f} GB / Total: {total_disk_gb:.2f} GB")
            logger.info(f"Uptime: {uptime_hours} hours, {uptime_minutes} minutes, {uptime_seconds} seconds")
            logger.info(f"Health check status: {health_check_status}")
        except Exception as e:
            logger.error(f"An error occurred while logging system metrics: {e}")
        finally:
            time.sleep(interval)

def start_metrics_logging(interval, start_time):
    try:
        global metrics_thread
        metrics_thread = Thread(target=log_system_metrics, args=(interval, start_time))  # Set interval and start time 
        metrics_thread.start()
    except Exception as e:
        logger.error(f"An error occurred while starting the metrics logging thread: {e}")

def is_valid_ipv4(ip):
    try:
        ipaddress.IPv4Address(ip)
        return True
    except ipaddress.AddressValueError:
        return False

def get_server_parameters():
    print(Style.BRIGHT + Fore.BLUE + "Welcome to the GoGrow App server setup!")
    try:
        if os.environ.get('DOCKER_CONTAINER', '').lower() == 'true':
            HOST = os.environ.get('SERVER_HOST', '0.0.0.0')
            try:
                PORT = int(os.environ.get('SERVER_PORT', '5555'))
            except ValueError:
                logger.error(Fore.RED + "Invalid port number in environment variables, setting to default (5555)")
                PORT = 5555
        else:
            use_default = input(Fore.GREEN + "Do you want to use the default settings? (localhost and port 5555?) yes/no: ")
            if use_default.lower() == 'yes':
                HOST = 'localhost'
                PORT = 5555
            else:
                while True:
                    HOST = input(Fore.CYAN + "Enter the host name or IP (localhost, 0.0.0.0, etc. - localhost is default): ")
                    if HOST == 'localhost' or is_valid_ipv4(HOST):
                        break
                    else:
                        logger.error(Fore.RED + "Invalid host name/IP. Please enter a valid IP or 'localhost'")
                
                PORT = input(Fore.CYAN + "Enter the port number (5555 is default): ")
                try:
                    PORT = 5555 if not PORT else int(PORT)
                except ValueError:
                    logger.error(Fore.RED + "Invalid port number, setting to default (5555)")
                    PORT = 5555
        return HOST, PORT
    except Exception as e:
        logger.error(Fore.RED + f"An error occurred while getting server parameters: {e}")
        return None, None

# Open browser window and start metrics logging
def open_browser_and_start_logging(url, use_default):
    try:
        # Open the browser
        if use_default:
            webbrowser.open("http://localhost:5555")
        else:
            webbrowser.open(url)
        
        # Start the metrics logging after the browser has been launched
        start_time = datetime.datetime.now()
        start_metrics_logging(1800, start_time)  # Start logging with an interval of 1800 seconds
    except Exception as e:
        logger.error(f"An error occurred while opening the web browser: {e}")

if __name__ == '__main__':
    print(Back.GREEN + Fore.WHITE + Style.BRIGHT + "Starting GoGrow App server setup...")
    HOST, PORT = get_server_parameters()
    logger.info(Fore.GREEN + f"Starting the server at {HOST}:{PORT}")

    # Set the server URL
    server_url = f"http://{HOST}:{PORT}"

    # Determine if default settings are used
    use_default_settings = HOST == 'localhost' and PORT == 5555

    # Start the server in a separate thread
    try:
        server_thread = Timer(0, waitress_serve, kwargs={'app': app, 'host': HOST, 'port': PORT})
        server_thread.daemon = True
        server_thread.start()

        # Open browser window and start metrics logging
        open_browser_and_start_logging(server_url, use_default_settings)

        try:
            # Wait for the server thread to complete
            server_thread.join()
        except KeyboardInterrupt:
            pass

        logger.info(Fore.RED + "Server has stopped.")

    except Exception as e:
        logger.error(f"An error occurred while starting the server: {e}")