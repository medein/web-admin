import os
import time
import datetime
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select

load_dotenv()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:5500/web-admin")


def login_admin(driver, wait):
    """Función auxiliar para autenticarse."""
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


def test_crear_usuario_admin():
    options = webdriver.ChromeOptions()
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 10)

    try:
        print("--- PASO 1: Autenticación en el sistema ---")
        login_admin(driver, wait)
        print("✓ Sesión iniciada correctamente.")

        print("\n--- PASO 2: Navegando a Usuarios y Admins ---")
        driver.get(f"{BASE_URL}/usuarios.html")

        print("\n--- PASO 3: Creación de Nuevo Admin de Complejo ---")
        btn_nuevo_usuario = wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Nuevo Usuario')]"))
        )
        btn_nuevo_usuario.click()

        wait.until(EC.visibility_of_element_located((By.ID, "modalUsuario")))

        # Localizar inputs del formulario
        input_nombre = wait.until(EC.presence_of_element_located((By.ID, "usuario-nombre")))
        input_email = driver.find_element(By.ID, "usuario-email")
        input_pass = driver.find_element(By.ID, "usuario-password")
        input_tel = driver.find_element(By.ID, "usuario-telefono")
        select_rol = Select(driver.find_element(By.ID, "usuario-rol"))
        elem_select_complejo = driver.find_element(By.ID, "usuario-complejo")
        select_complejo = Select(elem_select_complejo)
        btn_guardar = driver.find_element(By.XPATH, "//form[@id='formUsuario']//button[@type='submit']")

        timestamp = datetime.datetime.now().strftime("%H%M%S")
        nombre_test = f"Admin AutoTest {timestamp}"
        email_test = f"admin_test_{timestamp}@canchasapp.com"

        # Llenar datos
        input_nombre.clear()
        input_nombre.send_keys(nombre_test)

        input_email.clear()
        input_email.send_keys(email_test)

        input_pass.clear()
        input_pass.send_keys("ClaveAdmin123!")

        input_tel.clear()
        input_tel.send_keys("55551234")

        # Seleccionar rol 'admin_complejo'
        select_rol.select_by_value("admin_complejo")

        # Esperar a que se carguen las opciones de complejos en el select vía API
        wait.until(lambda d: len(select_complejo.options) > 0)
        select_complejo.select_by_index(0)  # Seleccionar el primer complejo asignable

        btn_guardar.click()

        # Validaciones de éxito
        wait.until(EC.invisibility_of_element_located((By.ID, "modalUsuario")))
        print("✓ Formulario enviado y modal cerrado.")

        lista_usuarios = wait.until(EC.presence_of_element_located((By.ID, "listaUsuarios")))
        wait.until(lambda d: nombre_test in lista_usuarios.text or email_test in lista_usuarios.text)

        print(f"✓ ¡Prueba exitosa! Administrador registrado y verificado en la lista: '{nombre_test}' ({email_test})")

    except Exception as e:
        print("X Error durante la ejecución de la prueba:", e)

    finally:
        time.sleep(2)
        driver.quit()


if __name__ == "__main__":
    test_crear_usuario_admin()