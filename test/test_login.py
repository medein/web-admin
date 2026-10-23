import os
import time
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Cargar .env de la carpeta actual
load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:5500/web-admin")


def test_login():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        print("\nX ERROR CRÍTICO: No se leyeron las credenciales.")
        print("Asegúrate de haber creado el archivo .env dentro de web-admin/test/")
        return

    options = webdriver.ChromeOptions()
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    try:
        URL_LOGIN = f"{BASE_URL}/login.html"
        driver.get(URL_LOGIN)
        driver.maximize_window()

        print("--- CASO DE PRUEBA 1: Intentar login con credenciales incorrectas ---")
        
        input_email = wait.until(EC.presence_of_element_located((By.ID, "email")))
        input_password = wait.until(EC.presence_of_element_located((By.ID, "password")))
        btn_entrar = wait.until(EC.element_to_be_clickable((By.ID, "btnEntrar")))

        input_email.clear()
        input_email.send_keys("usuario_falso@ejemplo.com")
        
        input_password.clear()
        input_password.send_keys("clave_incorrecta")
        
        btn_entrar.click()

        aviso_error = wait.until(EC.visibility_of_element_located((By.ID, "avisoLogin")))
        print("✓ Resultado esperado OK - Mensaje de error visibilizado:", aviso_error.text)

        time.sleep(2)

        print("\n--- CASO DE PRUEBA 2: Login exitoso con usuario administrador ---")

        input_email = driver.find_element(By.ID, "email")
        input_password = driver.find_element(By.ID, "password")
        btn_entrar = driver.find_element(By.ID, "btnEntrar")

        input_email.clear()
        input_email.send_keys(ADMIN_EMAIL)
        
        input_password.clear()
        input_password.send_keys(ADMIN_PASSWORD)

        btn_entrar.click()

        wait.until(EC.url_contains("index.html"))
        print("✓ ¡Prueba exitosa! Redirigido a:", driver.current_url)

    except Exception as e:
        print("X Error durante la ejecución de la prueba:", e)

    finally:
        time.sleep(2)
        driver.quit()


if __name__ == "__main__":
    test_login()