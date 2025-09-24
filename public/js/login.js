// js/login.js
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");

  if (!form) return; // Seguridad por si no encuentra el form

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // Evita que recargue la página

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        // ✅ Login correcto
        Swal.fire({
          icon: "success",
          title: "¡Bienvenido!",
          text: "Inicio de sesión exitoso",
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          window.location.href = "/reservas.html"; // Redirige al calendario
        });
      } else {
        // ❌ Login fallido
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Correo o contraseña incorrectos"
        });
      }
    } catch (error) {
      console.error("Error en login:", error);
      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        text: "No se pudo conectar al servidor"
      });
    }
  });
});
