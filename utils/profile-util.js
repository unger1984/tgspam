'use strict'

const first_names = ['Alex', 'Andrew', 'Marta', 'Joseph', 'Henry', 'William', 'Siobhan', 'Iwan', 'Nicola', 'Madelene', 'Ive', 'Diana', 'Jeff', 'James', 'Brooklyn', 'Kevin', 'Carla', 'Lilian', 'Melody']
const last_names = ['Vernik', 'Carlson', 'Spader', 'Janssen', 'Bush', 'Stein', 'Brook', 'Spencer', 'Miles', 'McQueen', 'Matters', 'Leech', 'Tate', 'Robson', 'Chrome', 'Pond', 'Pemberton']

export const generateFirstName = () => {
    return first_names[Math.floor(Math.random() * first_names.length)]
}

export const generateLastName = () => {
    return last_names[Math.floor(Math.random() * last_names.length)]
}