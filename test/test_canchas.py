import os
import time
import datetime
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

# Cargar el .env que está en la carpeta local test/
load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:5500/web-admin")


def login_admin(driver, wait):
    """Función auxiliar para autenticarse antes de acceder a la vista de canchas."""
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        raise ValueError("No se encontraron ADMIN_EMAIL o ADMIN_PASSWORD en el archivo .env")

    driver.get(f"{BASE_URL}/login.html")
    driver.maximize_window()

    input_email = wait.until(EC.presence_of_element_located((By.ID, "email")))
    input_password = wait.until(EC.presence_of_element_located((By.ID, "password")))
    btn_entrar = wait.until(EC.element_to_be_clickable((By.ID, "btnEntrar")))

    input_email.clear()
    input_email.send_keys(ADMIN_EMAIL)
    
    input_password.clear()
    input_password.send_keys(ADMIN_PASSWORD)

    btn_entrar.click()
    wait.until(EC.url_contains("index.html"))


def test_crear_cancha():
    options = webdriver.ChromeOptions()
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    try:
        print("--- PASO 1: Autenticación en el sistema ---")
        login_admin(driver, wait)
        print("✓ Sesión iniciada correctamente.")

        print("\n--- PASO 2: Navegando a Gestión de Canchas ---")
        driver.get(f"{BASE_URL}/canchas.html")

        print("\n--- PASO 3: Creación de Nueva Cancha ---")
        btn_nueva_cancha = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-bs-target='#modalNuevaCancha']"))
        )
        btn_nueva_cancha.click()

        wait.until(EC.visibility_of_element_located((By.ID, "modalNuevaCancha")))

        input_nombre = wait.until(EC.presence_of_element_located((By.ID, "nombreCancha")))
        select_tipo = Select(driver.find_element(By.ID, "tipoCancha"))
        input_precio = driver.find_element(By.ID, "precioCancha")
        btn_guardar = driver.find_element(By.XPATH, "//form[@id='formNuevaCancha']//button[@type='submit']")

        # Nombre dinámico con hora para evitar nombres duplicados
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        nombre_test = f"Cancha Sintética AutoTest {timestamp}"

        input_nombre.clear()
        input_nombre.send_keys(nombre_test)

        select_tipo.select_by_value("Sintética Techada")

        input_precio.clear()
        input_precio.send_keys("150.00")

        btn_guardar.click()

        wait.until(EC.invisibility_of_element_located((By.ID, "modalNuevaCancha")))
        print("✓ Formulario enviado y modal cerrado.")

        tabla = wait.until(EC.presence_of_element_located((By.ID, "tablaCanchas")))
        wait.until(lambda d: nombre_test in tabla.text)
        
        print(f"✓ ¡Prueba exitosa! Creada y verificada en tabla: '{nombre_test}'")

    except Exception as e:
        print("X Error durante la ejecución de la prueba:", e)

    finally:
        time.sleep(2)
        driver.quit()


if __name__ == "__main__":
    test_crear_cancha()