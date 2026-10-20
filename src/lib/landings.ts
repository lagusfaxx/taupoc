import type { Gender } from '@prisma/client';

/**
 * Páginas de aterrizaje para las búsquedas que la tienda no cubría.
 *
 * La gente en Chile no busca "traje de competición": busca "traje de baño de
 * competencia", "para mujer", "para niña". El catálogo con filtros no puede
 * posicionar esas consultas (los filtros van con noindex), así que cada
 * intención tiene su página propia, con texto visible, sus productos y un FAQ
 * que se muestra igual que en el JSON-LD.
 *
 * Todo dato que dependa de la tienda —precios, tallas, códigos— se arma en la
 * plantilla desde la base; acá solo va el texto que no cambia.
 */

export interface LandingSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LandingFaq {
  q: string;
  a: string;
}

export interface Landing {
  path: string;
  /** Título para el `<title>`, sin la marca: la agrega la plantilla del sitio. */
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  /** Productos que se muestran. Sin género salen todos los trajes. */
  gender?: Gender;
  /** Solo las tallas juveniles: la grilla muestra lo que tiene stock en ellas. */
  sizes?: string[];
  productsTitle: string;
  sections: LandingSection[];
  faq: LandingFaq[];
  /** Enlaces a las otras páginas del grupo, para que se encuentren entre sí. */
  related: string[];
}

export const LANDINGS = {
  // En Chile "fast skin" es el nombre común del traje de competencia: la gente
  // cree que así se llama el traje y lo busca escrito de varias formas. La
  // página habla en esos términos; la mención a Speedo queda solo en el FAQ,
  // para no presentar TAUPOC como su línea Fastskin.
  fastSkin: {
    path: '/fast-skin',
    title: 'Fast skin (fastskin) de competencia hombre y mujer',
    description:
      'Fast skin de competencia homologado World Aquatics: jammers y knee suits TAUPOC con stock en ' +
      'Chile. Tallas 20 a 36.',
    eyebrow: 'Fast skin',
    h1: 'Fast skin: trajes de competencia homologados',
    intro:
      'Fast skin, fastskin o fas skin: así se le dice en Chile al traje de baño de competencia, el jammer de ' +
      'hombre y el knee suit de mujer que se usan para competir. Acá tienes fast skins TAUPOC homologados ' +
      'por World Aquatics, con stock en Chile y el código de aprobación de cada modelo a la vista.',
    productsTitle: 'Fast skins disponibles',
    sections: [
      {
        title: 'Qué es un fast skin',
        paragraphs: [
          'Fast skin significa "piel rápida". Es un traje de competencia de tejido técnico, de baja absorción ' +
            'de agua y con costuras termoselladas, que comprime la musculatura y ordena la posición del cuerpo ' +
            'en el agua. El resultado es menos arrastre en cada brazada y en cada vuelta.',
          'Nadadores, entrenadores y apoderados le dicen fast skin a todos los trajes de competencia, sea cual ' +
            'sea la marca. Lo que define si un fast skin sirve para un torneo federado no es el nombre sino que ' +
            'el modelo esté en la lista de trajes aprobados de World Aquatics.',
        ],
      },
      {
        title: 'Fast skin hombre y fast skin mujer',
        paragraphs: ['La norma de World Aquatics define hasta dónde puede cubrir el traje:'],
        bullets: [
          'Fast skin hombre: el jammer, de la cintura a la rodilla.',
          'Fast skin mujer: el knee suit, cubre el torso sin pasar del hombro ni de la rodilla.',
          'Sin cierres, broches ni piezas rígidas, y sin aportar flotación.',
        ],
      },
      {
        title: 'Fast skin o traje de entrenamiento',
        paragraphs: [
          'Un traje de entrenamiento es de poliéster y aguanta el cloro de todos los días. Un fast skin pierde ' +
            'compresión con el uso, así que se reserva para las carreras: bien cuidado rinde entre 25 y 30 ' +
            'carreras.',
        ],
      },
      {
        title: 'Cómo elegir la talla de un fast skin',
        paragraphs: [
          'Un fast skin se usa una o dos tallas por debajo de la talla de cuerpo: si entra cómodo, no comprime. ' +
            'En 50 y 100 metros se baja dos tallas; en 800, 1500 y aguas abiertas, una. En un primer traje de ' +
            'carrera conviene bajar solo una.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Qué es un fast skin?',
        a:
          'Es como se le dice al traje de natación de competencia: un traje de compresión de tejido técnico, ' +
          'homologado por World Aquatics, que se usa solo para competir.',
      },
      {
        q: '¿Se escribe fast skin o fastskin?',
        a:
          'Se usan las dos, y también fas skin o fass skin. Todas se refieren a lo mismo: el traje de baño de ' +
          'competencia de compresión.',
      },
      {
        q: '¿Fast skin es una marca?',
        a:
          'El nombre viene de la línea Fastskin de Speedo, pero hoy se usa para cualquier traje de competencia. ' +
          'Los trajes TAUPOC son fast skins de otra marca, también homologados por World Aquatics.',
      },
      {
        q: '¿Cuánto dura un fast skin?',
        a:
          'Entre 25 y 30 carreras si se usa solo para competir, se enjuaga en agua fría y se seca a la sombra, ' +
          'extendido.',
      },
      {
        q: '¿Puedo competir en un torneo federado con un fast skin TAUPOC?',
        a:
          'Sí. Cada modelo tiene su código de homologación publicado en la ficha, y puedes verificarlo en la ' +
          'lista oficial de trajes aprobados de World Aquatics.',
      },
    ],
    related: [
      '/traje-de-bano-de-competencia-hombre',
      '/traje-de-bano-de-competencia-mujer',
      '/trajes-de-competencia-juveniles',
      '/como-ponerse-un-traje-de-competencia',
    ],
  },

  competencia: {
    path: '/trajes-de-bano-de-competencia',
    title: 'Trajes de baño de competencia en Chile',
    description:
      'Trajes de baño de competencia homologados por World Aquatics para hombre y mujer. Tallas 20 a 36, ' +
      'despacho a todo Chile.',
    eyebrow: 'Competencia',
    h1: 'Trajes de baño de competencia homologados',
    intro:
      'Un traje de baño de competencia no es un traje de entrenamiento más apretado: es una prenda técnica ' +
      'de compresión, aprobada por World Aquatics, que se usa solo en carrera. Acá tienes los modelos que ' +
      'tenemos en stock en Chile, para hombre y para mujer, con su código de homologación a la vista.',
    productsTitle: 'Trajes de competencia disponibles',
    sections: [
      {
        title: 'Qué hace distinto a un traje de competencia',
        paragraphs: [
          'Los trajes de carrera —también llamados fast skin, traje técnico o traje de compresión— están ' +
            'hechos con tejido de baja absorción de agua y costuras termoselladas. Comprimen la musculatura ' +
            'y ordenan la posición del cuerpo en el agua, lo que reduce el arrastre en cada brazada.',
          'Por eso se usan apretados: una talla o dos por debajo de la talla de cuerpo, según la prueba. ' +
            'Si entra cómodo, no está haciendo su trabajo.',
        ],
      },
      {
        title: 'Jammer para hombre, knee suit para mujer',
        paragraphs: [
          'La norma de World Aquatics define la cobertura. En hombre el traje va del ombligo a la rodilla: es ' +
            'el jammer. En mujer cubre el torso sin pasar del hombro ni de la rodilla: es el knee suit, o ' +
            'traje de pierna larga.',
        ],
        bullets: [
          'Jammer: cintura a rodilla, sin piezas rígidas ni cierres.',
          'Knee suit: espalda abierta o cerrada según el modelo, largo hasta la rodilla.',
          'Ambos sirven para piscina corta, piscina larga y la mayoría de las pruebas de aguas abiertas.',
        ],
      },
      {
        title: 'Por qué importa la homologación',
        paragraphs: [
          'En un campeonato federado el juez árbitro puede revisar el traje antes de la partida. Si el modelo ' +
            'no aparece en la lista pública de trajes aprobados de World Aquatics, el nadador no larga. Todos ' +
            'los trajes de esta página tienen su código de aprobación publicado en la ficha.',
        ],
      },
      {
        title: 'Marcas de trajes de baño de competencia',
        paragraphs: [
          'En la lista de World Aquatics hay modelos de muchas marcas: arena, Speedo, TYR, Mizuno, Jaked, Finis ' +
            'y TAUPOC, entre otras. Lo que importa no es la marca sino que el modelo exacto esté aprobado, que ' +
            'la talla sea la correcta y que puedas reponerlo durante la temporada. TAUPOC usa tejido técnico ' +
            'italiano y construcción termosellada, y nosotros somos su distribuidor oficial en Chile.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Cuánto dura un traje de baño de competencia?',
        a:
          'Bien cuidado, un traje de competición rinde entre 25 y 30 carreras. Se usa solo para competir, ' +
          'se enjuaga en agua fría después de cada uso y se seca a la sombra.',
      },
      {
        q: '¿Qué talla de traje de competencia compro?',
        a:
          'Mide cintura, cadera y estatura, busca tu talla de cuerpo en la guía de tallas y baja una o dos ' +
          'tallas según la distancia que nadas. Si quedas entre dos tallas, elige la menor.',
      },
      {
        q: '¿Puedo usar un traje de competencia para entrenar?',
        a:
          'No conviene. El tejido de compresión pierde sus propiedades con el cloro y el uso continuo. Para ' +
          'entrenar se usa un traje de poliéster resistente al cloro y el de competencia se guarda para la carrera.',
      },
      {
        q: '¿Hacen envíos a regiones?',
        a:
          'Sí, despachamos a todo Chile. En Santiago también puedes retirar sin costo o recibirlo en el torneo.',
      },
    ],
    related: [
      '/fast-skin',
      '/traje-de-bano-de-competencia-mujer',
      '/traje-de-bano-de-competencia-hombre',
      '/trajes-de-competencia-juveniles',
      '/como-ponerse-un-traje-de-competencia',
    ],
  },

  mujer: {
    path: '/traje-de-bano-de-competencia-mujer',
    title: 'Traje de baño de competencia mujer — knee suit',
    description:
      'Knee suits de competencia para mujer homologados por World Aquatics. Tallas 20 a 36, también para ' +
      'niñas y juveniles. Envío a todo Chile.',
    eyebrow: 'Competencia mujer',
    h1: 'Traje de baño de competencia para mujer',
    intro:
      'El traje de competencia femenino —el fast skin de mujer— es el knee suit: cubre el torso y llega hasta la rodilla, con ' +
      'tejido de compresión y costuras termoselladas. Todos los modelos de esta página están homologados ' +
      'por World Aquatics y se pueden usar en cualquier campeonato federado.',
    gender: 'FEMALE',
    productsTitle: 'Knee suits de competencia para mujer',
    sections: [
      {
        title: 'Cómo elegir un knee suit',
        paragraphs: [
          'Lo primero es la talla, no el color. Un knee suit se usa una o dos tallas por debajo de la talla de ' +
            'cuerpo: debe costar ponérselo. Con la talla correcta el traje no forma pliegues en la espalda ni ' +
            'deja entrar agua por las piernas al tirarse.',
          'Después mira el corte de la espalda y los tirantes. Un traje de espalda abierta da más movilidad de ' +
            'hombros; uno de espalda cerrada comprime más el torso.',
        ],
      },
      {
        title: 'Para niñas y juveniles',
        paragraphs: [
          'Las tallas parten en la 20, pensada para estaturas desde 140 cm, así que también sirven para niñas ' +
            'que empiezan a competir en categorías infantiles y juveniles. En un primer traje de carrera ' +
            'recomendamos bajar solo una talla: la compresión cuesta más a esa edad.',
        ],
      },
      {
        title: 'Cuándo usarlo',
        paragraphs: [
          'Solo en competencia. El tejido técnico se desgasta con el cloro, así que para entrenar usa un traje ' +
            'de entrenamiento y guarda el knee suit para las pruebas que importan.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Qué es un knee suit?',
        a:
          'Es el traje de competencia femenino de pierna larga: cubre el torso y llega hasta la rodilla. Es el ' +
          'largo máximo que permite World Aquatics para mujeres.',
      },
      {
        q: '¿Cuánto me demoro en ponerme un knee suit?',
        a:
          'La primera vez, entre 10 y 15 minutos. Se sube por tramos cortos, con las palmas abiertas y las ' +
          'uñas cortas o con guantes de algodón para no dañar el tejido.',
      },
      {
        q: '¿Sirve para una niña de 10 a 12 años?',
        a:
          'Si mide desde 140 cm, sí: la talla 20 está pensada para estaturas de 140 a 150 cm. Revisa cintura y ' +
          'cadera en la guía de tallas antes de comprar.',
      },
      {
        q: '¿Puedo cambiar la talla?',
        a:
          'Sí, tienes 10 días corridos desde que lo recibes, con el traje sin uso y con su etiqueta. En la ' +
          'Región Metropolitana el cambio es sin costo.',
      },
    ],
    related: [
      '/fast-skin',
      '/trajes-de-bano-de-competencia',
      '/traje-de-bano-de-competencia-hombre',
      '/trajes-de-competencia-juveniles',
      '/como-ponerse-un-traje-de-competencia',
    ],
  },

  hombre: {
    path: '/traje-de-bano-de-competencia-hombre',
    title: 'Traje de baño de competencia hombre — jammer',
    description:
      'Jammers de competencia para hombre homologados por World Aquatics. Tallas 20 a 36 con stock en Chile ' +
      'y despacho a todo el país.',
    eyebrow: 'Competencia hombre',
    h1: 'Traje de baño de competencia para hombre',
    intro:
      'En natación masculina el traje de competencia —el fast skin de hombre— es el jammer: va de la cintura a la rodilla, comprime ' +
      'la musculatura y reduce el arrastre. Todos los modelos de esta página están homologados por World ' +
      'Aquatics y tienen stock en Chile.',
    gender: 'MALE',
    productsTitle: 'Jammers de competencia para hombre',
    sections: [
      {
        title: 'Jammer de competencia o de entrenamiento',
        paragraphs: [
          'Un jammer de entrenamiento es de poliéster y aguanta el cloro de todos los días. El de competencia ' +
            'usa tejido técnico de baja absorción y costuras termoselladas: pesa menos mojado, comprime y está ' +
            'aprobado por World Aquatics para campeonatos federados.',
        ],
      },
      {
        title: 'La talla correcta',
        paragraphs: [
          'Un jammer de carrera se usa entre una y dos tallas por debajo de la talla de cuerpo. En pruebas de ' +
            '50 y 100 metros se baja dos tallas; en 800, 1500 y aguas abiertas basta con una. Si al ponértelo ' +
            'no cuesta subirlo por los muslos, es grande.',
        ],
      },
      {
        title: 'Para juveniles',
        paragraphs: [
          'La talla 20 parte en 140 cm de estatura, así que también sirve para nadadores infantiles y ' +
            'juveniles que empiezan a competir.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Qué es un jammer?',
        a:
          'Es el traje de competencia masculino que va de la cintura a la rodilla. Es el largo máximo que ' +
          'permite World Aquatics para hombres.',
      },
      {
        q: '¿Cuántas carreras dura un jammer de competencia?',
        a:
          'Entre 25 y 30 carreras si se usa solo para competir, se enjuaga en agua fría y se seca a la sombra.',
      },
      {
        q: '¿Puedo cambiar la talla?',
        a:
          'Sí, tienes 10 días corridos desde que lo recibes, con el traje sin uso y con su etiqueta. En la ' +
          'Región Metropolitana el cambio es sin costo.',
      },
    ],
    related: [
      '/fast-skin',
      '/trajes-de-bano-de-competencia',
      '/traje-de-bano-de-competencia-mujer',
      '/trajes-de-competencia-juveniles',
      '/como-ponerse-un-traje-de-competencia',
    ],
  },

  juveniles: {
    path: '/trajes-de-competencia-juveniles',
    title: 'Trajes de competencia para niñas, niños y juveniles',
    description:
      'Trajes de baño de competencia para niñas, niños y juveniles desde 140 cm de estatura. Homologados ' +
      'World Aquatics, tallas 20 a 24.',
    eyebrow: 'Infantil y juvenil',
    h1: 'Trajes de competencia para niñas, niños y juveniles',
    intro:
      'Las primeras competencias federadas piden lo mismo que las de adultos: un traje homologado por World ' +
      'Aquatics. Nuestras tallas parten en la 20, para estaturas desde 140 cm, así que los nadadores ' +
      'infantiles y juveniles pueden competir con el mismo traje que los adultos.',
    sizes: ['20', '22', '24'],
    productsTitle: 'Con stock en tallas 20 a 24',
    sections: [
      {
        title: 'Cuándo comprar el primer traje de competencia',
        paragraphs: [
          'Cuando el nadador ya compite en campeonatos federados y las pruebas se deciden por décimas. Antes ' +
            'de eso, un buen traje de entrenamiento es suficiente.',
          'Para un primer traje de carrera recomendamos bajar solo una talla respecto de la talla de cuerpo: a ' +
            'esa edad la compresión cuesta más y un traje demasiado chico se rompe al ponerlo.',
        ],
      },
      {
        title: 'Tallas juveniles',
        paragraphs: ['Medidas de cuerpo de referencia. Revisa la guía de tallas para cintura y cadera exactas.'],
        bullets: [
          'Talla 20: estatura de 140 a 150 cm.',
          'Talla 22: estatura de 148 a 158 cm.',
          'Talla 24: estatura de 155 a 165 cm.',
        ],
      },
      {
        title: 'Para apoderados',
        paragraphs: [
          'Un traje de competencia se usa solo en carrera, se enjuaga en agua fría y se seca a la sombra. Así ' +
            'dura una temporada completa. Si el club compra para varios nadadores, tenemos precios por volumen ' +
            'desde 10 unidades.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Desde qué edad se usa un traje de competencia?',
        a:
          'No hay una edad fija: depende de la estatura y de si el nadador ya compite. La talla 20 está pensada ' +
          'para estaturas de 140 a 150 cm.',
      },
      {
        q: '¿Los trajes juveniles están homologados?',
        a:
          'Sí. La homologación de World Aquatics es por modelo, y vale para todas sus tallas, incluidas las ' +
          'juveniles.',
      },
      {
        q: '¿Qué pasa si el traje le queda chico?',
        a:
          'Tienes 10 días corridos para cambiar la talla, con el traje sin uso y con su etiqueta. En la ' +
          'Región Metropolitana el cambio es sin costo.',
      },
    ],
    related: [
      '/traje-de-bano-de-competencia-mujer',
      '/traje-de-bano-de-competencia-hombre',
      '/trajes-de-bano-de-competencia',
      '/clubes',
    ],
  },

  ponerse: {
    path: '/como-ponerse-un-traje-de-competencia',
    title: 'Cómo ponerse un traje de baño de competencia',
    description:
      'Paso a paso para ponerse un traje de competencia sin romperlo: preparación, piernas, cadera y torso. ' +
      'Tiempos y errores comunes.',
    eyebrow: 'Guía',
    h1: 'Cómo ponerse un traje de baño de competencia',
    intro:
      'La mayoría de los trajes de competencia se rompen al ponérselos, no nadando. Un traje de compresión ' +
      'bien elegido cuesta ponérselo: es normal que tome entre 10 y 15 minutos la primera vez. Estos son los ' +
      'pasos para hacerlo sin dañar el tejido.',
    productsTitle: 'Trajes de competencia',
    sections: [
      {
        title: 'Antes de empezar',
        paragraphs: ['Prepárate con tiempo: no lo hagas en el último llamado a la cámara de llamados.'],
        bullets: [
          'Uñas cortas o guantes de algodón: las uñas rompen el bonding de las costuras.',
          'Piel seca: con la piel mojada el tejido se pega y cuesta más subirlo.',
          'Siéntate: ponérselo de pie y sin apoyo termina en tirones.',
        ],
      },
      {
        title: 'Paso a paso',
        paragraphs: [
          'Entra con una pierna a la vez, sin apuro. Sube el tejido con las palmas abiertas, en tramos de unos ' +
            'cinco centímetros, alternando pierna derecha e izquierda. Nunca tires desde el borde ni desde las ' +
            'costuras.',
          'Cuando el borde de la pierna llegue a su lugar —justo sobre la rodilla— sigue con la cadera y la ' +
            'cintura. En el knee suit, sube el torso de a poco y pasa un brazo a la vez por los tirantes.',
          'Al final, acomoda el tejido desde abajo hacia arriba para eliminar pliegues. Un pliegue es agua que ' +
            'entra y arrastre que suma.',
        ],
      },
      {
        title: 'Errores comunes',
        paragraphs: ['Lo que más rompe trajes:'],
        bullets: [
          'Tirar del borde de la pierna o de los tirantes.',
          'Ponérselo apurado, de pie y sin apoyo.',
          'Usar una talla demasiado chica: baja una o dos tallas, no más.',
          'Lavarlo con agua caliente o secarlo al sol.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Cuánto se demora uno en ponerse un traje de competencia?',
        a:
          'Entre 10 y 15 minutos la primera vez. Con práctica se hace más rápido, pero siempre conviene ' +
          'hacerlo con tiempo antes de la prueba.',
      },
      {
        q: '¿Es normal que cueste tanto ponérselo?',
        a:
          'Sí. Un traje de compresión se usa una o dos tallas por debajo de la talla de cuerpo. Si entra fácil, ' +
          'probablemente es grande.',
      },
      {
        q: '¿Cómo se cuida después de la carrera?',
        a:
          'Enjuágalo en agua fría sin jabón, sécalo a la sombra, extendido. Así rinde entre 25 y 30 ' +
          'carreras.',
      },
    ],
    related: [
      '/fast-skin',
      '/guia-de-tallas',
      '/trajes-de-bano-de-competencia',
      '/traje-de-bano-de-competencia-mujer',
      '/traje-de-bano-de-competencia-hombre',
    ],
  },
} satisfies Record<string, Landing>;

/** Nombre corto de cada página para los enlaces cruzados. */
export const LANDING_LINKS: Record<string, string> = {
  '/fast-skin': 'Fast skin de competencia',
  '/trajes-de-bano-de-competencia': 'Trajes de baño de competencia',
  '/traje-de-bano-de-competencia-mujer': 'Traje de competencia mujer',
  '/traje-de-bano-de-competencia-hombre': 'Traje de competencia hombre',
  '/trajes-de-competencia-juveniles': 'Trajes juveniles e infantiles',
  '/como-ponerse-un-traje-de-competencia': 'Cómo ponerse el traje',
  '/guia-de-tallas': 'Guía de tallas',
  '/clubes': 'Clubes y equipos',
};
