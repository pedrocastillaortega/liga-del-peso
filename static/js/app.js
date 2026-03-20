// La Liga del Peso - Frontend JS

document.addEventListener('DOMContentLoaded', function() {
    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert-dismissible');
    alerts.forEach(function(alert) {
        setTimeout(function() {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            bsAlert.close();
        }, 5000);
    });

    // Confirm before submitting weigh-in
    const weighInForm = document.getElementById('weighInForm');
    if (weighInForm) {
        weighInForm.addEventListener('submit', function(e) {
            const inputs = weighInForm.querySelectorAll('input[type="number"]');
            let hasValue = false;
            inputs.forEach(function(input) {
                if (input.value.trim() !== '') {
                    hasValue = true;
                }
            });

            if (!hasValue) {
                e.preventDefault();
                alert('¡Introduce al menos un peso!');
                return false;
            }

            return confirm('¿Registrar el pesaje de esta semana?');
        });
    }
});
