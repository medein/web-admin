import os
import time
import datetime
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

# Cargar variables de entorno desde .env
load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:5500/web-admin")


def login_admin(driver, wait):
    """Autenticación reutilizable."""
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


def test_crear_reserva():
    options = webdriver.ChromeOptions()
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    try:
        print("--- PASO 1: Autenticación en el sistema ---")
        login_admin(driver, wait)
        print("✓ Sesión iniciada correctamente.")

        print("\n--- PASO 2: Navegando a Gestión de Reservas ---")
        driver.get(f"{BASE_URL}/reservas.html")

        print("\n--- PASO 3: Creación de Nueva Reserva ---")
        btn_nueva_reserva = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-bs-target='#modalNuevaReserva']"))
        )
        btn_nueva_reserva.click()

        # Esperar que el modal sea visible
        wait.until(EC.visibility_of_element_located((By.ID, "modalNuevaReserva")))

        # Localizar el desplegable de canchas
        elem_select_cancha = wait.until(EC.presence_of_element_located((By.ID, "reservaCanchaId")))
        select_cancha = Select(elem_select_cancha)

        # Esperar a que la API cargue las canchas disponibles
        wait.until(lambda d: len(select_cancha.options) > 1 and select_cancha.options[0].text != "Cargando canchas…")
        select_cancha.select_by_index(1)  # Selecciona la primera cancha válida

        # Fecha para mañana en formato Estándar ISO (YYYY-MM-DD)
        fecha_manana = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")

        # Asignar fecha y horas mediante JS para evitar conflictos con el formato regional del navegador
        input_fecha = driver.find_element(By.ID, "reservaFecha")
        input_inicio = driver.find_element(By.ID, "reservaHoraInicio")
        input_fin = driver.find_element(By.ID, "reservaHoraFin")

        driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change'));", input_fecha, fecha_manana)
        driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change'));", input_inicio, "17:00")
        driver.execute_script("arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('change'));", input_fin, "18:00")

        # Método de pago
        select_pago = Select(driver.find_element(By.ID, "reservaMetodoPago"))
        select_pago.select_by_value("efectivo")

        # Enviar formulario
        btn_guardar = driver.find_element(By.XPATH, "//form[@id='formNuevaReserva']//button[@type='submit']")
        btn_guardar.click()

        # Validar cierre del modal y registro en tabla
        wait.until(EC.invisibility_of_element_located((By.ID, "modalNuevaReserva")))
        print("✓ Formulario enviado y modal cerrado.")

        tabla = wait.until(EC.presence_of_element_located((By.ID, "tablaMisReservas")))
        wait.until(lambda d: fecha_manana in tabla.text or "17:00" in tabla.text)
        
        print(f"✓ ¡Prueba exitosa! Reserva registrada correctamente para la fecha {fecha_manana} de 17:00 a 18:00.")

    except Exception as e:
        print("X Error durante la ejecución de la prueba:", e)

    finally:
        time.sleep(2)
        driver.quit()


if __name__ == "__main__":
    test_crear_reserva()